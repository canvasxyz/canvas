import { logger } from "@libp2p/logger"

import * as ATP from "@atproto/api"

// Unfortunately this is necessary until the BlueSky team
// decides to publish ESM modules (please, it's not 2010)
const BskyAgent = ATP.BskyAgent ?? ATP["default"].BskyAgent

import type { Action, Message, Session, SessionSigner, Signature } from "@canvas-js/interfaces"
import { Secp256k1Signer } from "@canvas-js/signed-cid"

import target from "#target"

import { unpackArchive } from "./mst.js"
import { verifyCommit } from "./commit.js"
import { Operation, verifyLog } from "./operation.js"
import { assert, service, signalInvalidType } from "./utils.js"

type PostRecord = { $type: "app.bsky.feed.post"; text: string; createdAt: string }

export type ATPSessionData = {
	verificationMethod: string
	plcOperationLog: Operation[]
	recordArchive: Uint8Array
	recordURI: string
}

export interface ATPSignerOptions {
	login?: () => Promise<{ identifier: string; password: string }>
}

export class ATPSigner implements SessionSigner<ATPSessionData> {
	public static createAuthenticationMessage(topic: string, publicKey: string, address: string) {
		return `Authorizing ${publicKey} to sign actions for ${topic} on behalf of ${address}`
	}

	private readonly log = logger("canvas:chain-atp")

	#store = target.getSessionStore()
	#agent = new BskyAgent({ service: `https://${service}` })
	#session: ATP.AtpSessionData | null = null

	public constructor(private readonly options: ATPSignerOptions = {}) {}

	public match = (address: string) => address.startsWith("did:plc:")

	public async verifySession(topic: string, session: Session<ATPSessionData>): Promise<void> {
		const { verificationMethod, recordArchive, recordURI, plcOperationLog } = session.authorizationData
		await verifyLog(session.address, plcOperationLog).then((key) =>
			assert(key === verificationMethod, "invalid verification method")
		)

		const prefix = `at://${session.address}/`
		assert(recordURI.startsWith(prefix), "invalid record URI")
		const path = recordURI.slice(prefix.length)
		const { commit, record } = await unpackArchive<PostRecord>(recordArchive, path)
		await verifyCommit(verificationMethod, commit)

		const message = ATPSigner.createAuthenticationMessage(topic, session.publicKey, session.address)
		assert(record.text === message, "invalid app.bsky.feed.post record text")
	}

	private async getAddress(): Promise<string> {
		if (this.#session !== null) {
			return this.#session.did
		}

		const sessionData = target.loadJWTSession()
		if (sessionData !== null) {
			this.#session = sessionData
			await this.#agent.resumeSession(sessionData)
			return this.#session.did
		}

		assert(this.options.login !== undefined, "options.login must be provided")
		const { identifier, password } = await this.options.login()
		const { success } = await this.#agent.login({ identifier, password })
		assert(success, "login failed")
		assert(this.#agent.session !== undefined, "internal error (session not found)")
		this.#session = this.#agent.session
		target.saveJWTSession(this.#session)

		return this.#session.did
	}

	public async getSession(
		topic: string,
		options: { chain?: string; timestamp?: number } = {}
	): Promise<Session<ATPSessionData>> {
		this.log("getting session %s")

		const address = await this.getAddress()
		assert(address.startsWith("did:plc:"), "only plc DIDs are supported")

		{
			const { signer, session } = this.#store.get(topic, address) ?? {}
			if (signer !== undefined && session !== undefined) {
				const { timestamp, duration } = session
				const t = options.timestamp ?? timestamp
				if (timestamp <= t && t <= timestamp + (duration ?? Infinity)) {
					this.log("found session for %s in cache: %o", address, session)
					return session
				} else {
					this.log("cached session for %s has expired", address)
				}
			}
		}

		this.log("creating new session for %s", address)

		this.log("fetching plc operation log for %s", address)
		const plcOperationLog = await fetch(`https://plc.directory/${address}/log`).then((res) => res.json())
		const verificationMethod = await verifyLog(address, plcOperationLog)
		this.log("got plc operation log with verification method %s", verificationMethod)

		const signer = new Secp256k1Signer()
		const message = ATPSigner.createAuthenticationMessage(topic, signer.uri, address)

		this.log("posting authentication record for %s", address)
		const { uri, cid } = await this.#agent.post({ text: message })
		this.log("created post %s (%c)", uri, cid)

		const prefix = `at://${address}/`
		assert(uri.startsWith(prefix), "unexpected record URI")
		const [collection, rkey] = uri.slice(prefix.length).split("/")
		assert(collection === "app.bsky.feed.post", "unexepcted collection NSID")

		this.log("waiting 2000ms before fetching merkle inclusion proof")
		await new Promise((resolve) => setTimeout(resolve, 2000))
		this.log("fetching merkle inclusion proof")
		const result = await this.#agent.api.com.atproto.sync.getRecord({ did: address, collection, rkey })
		assert(result.success, "failed to fetch merkle inclusion proof from PDS")
		this.log("got merkle inclusion proof")

		this.log("deleting authenticion record")
		await this.#agent.deletePost(uri)
		this.log("deleted authenticion record")

		const session: Session<ATPSessionData> = {
			type: "session",
			address: address,
			publicKey: signer.uri,
			authorizationData: {
				verificationMethod,
				recordArchive: result.data,
				recordURI: uri,
				plcOperationLog,
			},
			blockhash: null,
			duration: null,
			timestamp: options.timestamp ?? Date.now(),
		}

		this.#store.set(topic, address, session, signer)

		return session
	}

	public sign(message: Message<Action | Session>): Signature {
		if (message.payload.type === "action") {
			const { address, timestamp } = message.payload
			const { signer, session } = this.#store.get(message.topic, address) ?? {}
			assert(signer !== undefined && session !== undefined)

			assert(address === session.address)
			assert(timestamp >= session.timestamp)
			assert(timestamp <= session.timestamp + (session.duration ?? Infinity))

			return signer.sign(message)
		} else if (message.payload.type === "session") {
			const { signer, session } = this.#store.get(message.topic, message.payload.address) ?? {}
			assert(signer !== undefined && session !== undefined)

			// only sign our own current sessions
			assert(message.payload === session)
			return signer.sign(message)
		} else {
			signalInvalidType(message.payload)
		}
	}

	public clear(topic: string) {
		this.#store.clear(topic)
	}
}
