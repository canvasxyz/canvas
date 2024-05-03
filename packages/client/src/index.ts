import * as json from "@ipld/dag-json"
import { StatusCodes } from "http-status-codes"

import type { Action, Message, Session, SessionSigner, Signer } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

export class Client {
	constructor(readonly signer: SessionSigner, readonly host: string, readonly topic: string) {}

	public async sendAction(name: string, args: any) {
		const timestamp = Date.now()

		// first check for an existing session
		let [session, delegateSigner] = await this.signer.getSession(this.topic)
		if (session !== null && delegateSigner !== null) {
			// then check that it exists in the log and hasn't expired
			const query = { address: session.address, publicKey: delegateSigner.publicKey, minExpiration: timestamp }
			const queryComponents = Object.entries(query)
				.map((query) => query.join("="))
				.join("&")

			const sessions: { id: string; expiration: number | null }[] = await fetch(
				`${this.host}/sessions?${queryComponents}`,
			).then((res) => res.json())

			if (sessions.length === 0) {
				;[session, delegateSigner] = [null, null]
			}
		}

		const head: { clock: number; parents: string[] } = await fetch(`${this.host}/clock`).then((res) => res.json())

		if (session === null || delegateSigner === null) {
			;[session, delegateSigner] = await this.signer.newSession(this.topic)

			const sessionId = await this.insert(delegateSigner, {
				topic: this.topic,
				clock: head.clock,
				parents: head.parents,
				payload: session,
			})

			head.clock += 1
			head.parents = [sessionId]
		}

		await this.insert(delegateSigner, {
			topic: this.topic,
			clock: head.clock,
			parents: head.parents,
			payload: { type: "action", address: session.address, name, args, blockhash: null, timestamp },
		})
	}

	private async insert(delegateSigner: Signer<Action | Session>, message: Message<Action | Session>): Promise<string> {
		const signature = await delegateSigner.sign(message)

		const res = await fetch(`${this.host}/messages`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: json.stringify({ signature, message }),
		})

		assert(res.status === StatusCodes.CREATED)
		const locationHeader = res.headers.get("location")

		assert(locationHeader !== null && locationHeader.startsWith("messages/"))
		const [_, id] = locationHeader.split("/")

		return id
	}
}
