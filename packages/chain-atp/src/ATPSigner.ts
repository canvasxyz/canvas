import * as ATP from "@atproto/api"

// Unfortunately this is necessary until the BlueSky team decides
// to publish ESM modules (please, it's been ten years since ES6)
const BskyAgent = ATP.BskyAgent ?? ATP["default"].BskyAgent

import type { Session, AbstractSessionData, DidIdentifier } from "@canvas-js/interfaces"
import { AbstractSessionSigner, ed25519 } from "@canvas-js/signatures"
import { assert } from "@canvas-js/utils"

import { unpackArchive } from "./mst.js"
import { verifyCommit } from "./commit.js"
import { Operation, verifyLog } from "./operation.js"

const service = "bsky.social"

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

export class ATPSigner extends AbstractSessionSigner<ATPSessionData> {
	public static createAuthenticationMessage(topic: string, publicKey: string, address: string) {
		return `Authorizing ${publicKey} to sign actions for ${topic} on behalf of ${address}`
	}

	#agent = new BskyAgent({ service: `https://${service}` })
	#session: ATP.AtpSessionData | null = null

	public constructor(private readonly options: ATPSignerOptions = {}) {
		super("chain-atp", ed25519, {})
	}

	public readonly match = (address: string) => address.startsWith("did:plc:") || address.startsWith("did:web:")

	public async verifySession(topic: string, session: Session<ATPSessionData>): Promise<void> {
		const { verificationMethod, recordArchive, recordURI, plcOperationLog } = session.authorizationData
		await verifyLog(session.did, plcOperationLog).then((key) =>
			assert(key === verificationMethod, "invalid verification method"),
		)

		const prefix = `at://${session.did}/`
		assert(recordURI.startsWith(prefix), "invalid record URI")
		const path = recordURI.slice(prefix.length)
		const { commit, record } = await unpackArchive<PostRecord>(recordArchive, path)
		await verifyCommit(verificationMethod, commit)

		const message = ATPSigner.createAuthenticationMessage(topic, session.publicKey, session.did)
		assert(record.text === message, "invalid app.bsky.feed.post record text")
	}

	public async getDid(): Promise<DidIdentifier> {
		if (this.#session !== null) {
			return this.#session.did as DidIdentifier
		}

		const sessionData = this.loadJWTSession()
		if (sessionData !== null) {
			this.#session = sessionData
			await this.#agent.resumeSession(sessionData)
			return this.#session.did as DidIdentifier
		}

		assert(this.options.login !== undefined, "options.login must be provided")
		const { identifier, password } = await this.options.login()
		const { success } = await this.#agent.login({ identifier, password })
		assert(success, "login failed")
		assert(this.#agent.session !== undefined, "internal error (session not found)")
		this.#session = this.#agent.session
		this.saveJWTSession(this.#session)

		return this.#session.did as DidIdentifier
	}

	public getDidParts() {
		return 3
	}

	public getAddressFromDid(did: DidIdentifier) {
		return did
	}

	private loadJWTSession(): ATP.AtpSessionData | null {
		const value = this.target.get("canvas-chain-atp/jwt")
		if (value === null) {
			return null
		} else {
			return JSON.parse(value)
		}
	}

	private saveJWTSession(data: ATP.AtpSessionData) {
		this.target.set("canvas-chain-atp/jwt", JSON.stringify(data))
	}

	public async authorize(data: AbstractSessionData): Promise<Session<ATPSessionData>> {
		const {
			topic,
			did,
			publicKey,
			context: { timestamp, duration },
		} = data
		this.log("fetching plc operation log for %s", did)
		const plcOperationLog = await fetch(`https://plc.directory/${did}/log`).then((res) => res.json())
		const verificationMethod = await verifyLog(did, plcOperationLog)
		this.log("got plc operation log with verification method %s", verificationMethod)

		const message = ATPSigner.createAuthenticationMessage(topic, publicKey, did)

		this.log("posting authentication record for %s", did)
		const { uri, cid } = await this.#agent.post({ text: message })
		this.log("created post %s (%c)", uri, cid)

		const prefix = `at://${did}/`
		assert(uri.startsWith(prefix), "unexpected record URI")
		const [collection, rkey] = uri.slice(prefix.length).split("/")
		assert(collection === "app.bsky.feed.post", "unexepcted collection NSID")

		this.log("waiting 2000ms before fetching merkle inclusion proof")
		await new Promise((resolve) => setTimeout(resolve, 2000))
		this.log("fetching merkle inclusion proof")
		const result = await this.#agent.api.com.atproto.sync.getRecord({ did: did, collection, rkey })
		assert(result.success, "failed to fetch merkle inclusion proof from PDS")
		this.log("got merkle inclusion proof")

		this.log("deleting authenticion record")
		await this.#agent.deletePost(uri)
		this.log("deleted authenticion record")

		return {
			type: "session",
			did: did,
			publicKey: publicKey,
			authorizationData: {
				verificationMethod,
				recordArchive: result.data,
				recordURI: uri,
				plcOperationLog,
			},
			context: duration ? { duration, timestamp } : { timestamp },
		}
	}
}
