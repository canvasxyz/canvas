import * as json from "@ipld/dag-json"
import { logger } from "@libp2p/logger"

import * as ATP from "@atproto/api"

// Unfortunately this is necessary until the BlueSky team
// decides to publish ESM modules (please, it's not 2010)
const BskyAgent = ATP.BskyAgent ?? ATP["default"].BskyAgent

import type { Action, Message, Signer, Session, SessionSigner, SessionStore, Signature } from "@canvas-js/interfaces"
import { Secp256k1Signer } from "@canvas-js/signed-cid"

import { unpackArchive } from "./mst.js"
import { verifyCommit } from "./commit.js"
import { Operation, verifyLog } from "./operation.js"
import { assert, getKey, service } from "./utils.js"

type PostRecord = { $type: "app.bsky.feed.post"; text: string; createdAt: string }

export type ATPSessionData = {
	verificationMethod: string
	plcOperationLog: Operation[]
	recordArchive: Uint8Array
	recordURI: string
}

export interface ATPSignerOptions {
	login?: () => Promise<{ identifier: string; password: string }>
	store?: SessionStore
}

export class ATPSigner implements SessionSigner<ATPSessionData> {
	public static createAuthenticationMessage(publicKey: string, address: string) {
		return `Authorizing ${publicKey} to sign actions on Canvas on behalf of ${address}`
	}

	private readonly log = logger("canvas:chain-ethereum")

	#agent = new BskyAgent({ service: `https://${service}` })
	#sessions: Record<string, Session<ATPSessionData>> = {}
	#signers: Record<string, Signer<Message<Action | Session>>> = {}

	public constructor(private readonly options: ATPSignerOptions = {}) {}

	public match = (address: string) => address.startsWith("did:plc:")

	public sign(message: Message<Action | Session<ATPSessionData>>): Signature {
		const key = getKey(message.topic)
		const session = this.#sessions[key]
		const signer = this.#signers[key]
		assert(session !== undefined && signer !== undefined, "internal error (missing session for topic)")
		if (message.payload.type === "action") {
			assert(message.payload.address === session.address)
		} else if (message.payload.type === "session") {
			assert(message.payload === session, "internal error (received foreign session object)")
		}

		return signer.sign(message)
	}

	public async getSession(
		topic: string,
		options: { chain?: string; timestamp?: number } = {}
	): Promise<Session<ATPSessionData>> {
		const key = getKey(topic)

		this.log("getting session %s", key)
		// First check the in-memory cache
		if (this.#sessions[key] !== undefined) {
			const session = this.#sessions[key]
			const { timestamp, duration } = session
			const t = options.timestamp ?? timestamp
			if (timestamp <= t && t <= timestamp + (duration ?? Infinity)) {
				this.log("found session %s in cache: %o", key, session)
				return session
			} else {
				this.log("cached session %s has expired", key)
			}
		}

		// Then check the persistent store
		if (this.options.store !== undefined) {
			const privateSessionData = await this.options.store.get(key)
			if (privateSessionData !== null) {
				const { type, privateKey, session } = json.parse<{
					type: "secp256k1"
					privateKey: Uint8Array
					session: Session<ATPSessionData>
				}>(privateSessionData)

				assert(type === "secp256k1", "invalid key type")

				const { timestamp, duration } = session
				const t = options.timestamp ?? timestamp
				if (timestamp <= t && t <= timestamp + (duration ?? Infinity)) {
					this.#sessions[key] = session
					this.#signers[key] = new Secp256k1Signer(privateKey)
					this.log("found session %s in store: %o", key, session)
					return session
				} else {
					this.log("stored session %s has expired", key)
				}
			}
		}

		this.log("creating new session for %s", key)
		if (this.options.login === undefined) {
			throw new Error("ATPSigner: login callback is required for authentication")
		}

		const { identifier, password } = await this.options.login()
		const { success, data } = await this.#agent.login({ identifier, password })
		assert(success, "Authentication failed")
		assert(data.did.startsWith("did:plc:"), "only plc DIDs are supported")

		// TODO: cache `data`

		this.log("fetching plc operation log for %s", data.did)
		const plcOperationLog = await fetch(`https://plc.directory/${data.did}/log`).then((res) => res.json())
		const verificationMethod = await verifyLog(data.did, plcOperationLog)
		this.log("got plc operation log with verification method %s", verificationMethod)

		const signer = new Secp256k1Signer()
		const message = ATPSigner.createAuthenticationMessage(signer.uri, data.did)

		this.log("posting authentication record for %s", data.did)
		const { uri, cid } = await this.#agent.post({ text: message })
		this.log("created post %s (%c)", uri, cid)

		const prefix = `at://${data.did}/`
		assert(uri.startsWith(prefix), "unexpected record URI")
		const [collection, rkey] = uri.slice(prefix.length).split("/")
		assert(collection === "app.bsky.feed.post", "unexepcted collection NSID")

		this.log("waiting 2000ms before fetching merkle inclusion proof")
		await new Promise((resolve) => setTimeout(resolve, 2000))
		this.log("fetching merkle inclusion proof")
		const result = await this.#agent.api.com.atproto.sync.getRecord({ did: data.did, collection, rkey })
		assert(result.success, "failed to fetch merkle inclusion proof from PDS")
		this.log("got merkle inclusion proof")

		this.log("deleting authenticion record")
		await this.#agent.deletePost(uri)
		this.log("deleted authenticion record")

		const session: Session<ATPSessionData> = {
			type: "session",
			address: data.did,
			publicKey: signer.uri,
			data: {
				verificationMethod,
				recordArchive: result.data,
				recordURI: uri,
				plcOperationLog,
			},
			blockhash: null,
			duration: null,
			timestamp: options.timestamp ?? Date.now(),
		}

		this.#sessions[key] = session
		this.#signers[key] = signer

		if (this.options.store !== undefined) {
			const { type, privateKey } = signer.export()
			await this.options.store.set(key, json.stringify({ type, privateKey, session }))
		}

		return session
	}

	public async verifySession(session: Session<ATPSessionData>): Promise<void> {
		const { verificationMethod, recordArchive, recordURI, plcOperationLog } = session.data
		await verifyLog(session.address, plcOperationLog).then((key) =>
			assert(key === verificationMethod, "invalid verification method")
		)

		const prefix = `at://${session.address}/`
		assert(recordURI.startsWith(prefix), "invalid record URI")
		const path = recordURI.slice(prefix.length)
		const { commit, record } = await unpackArchive<PostRecord>(recordArchive, path)
		await verifyCommit(verificationMethod, commit)

		const message = ATPSigner.createAuthenticationMessage(session.publicKey, session.address)
		assert(record.text === message, "invalid app.bsky.feed.post record text")
	}
}
