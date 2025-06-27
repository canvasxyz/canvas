import * as json from "@ipld/dag-json"
import { StatusCodes } from "http-status-codes"

import type { Action, Message, MessageType, SessionSigner, Signature, Signer } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

export class Client {
	public readonly actions: Record<
		string,
		(...args: any[]) => Promise<{ id: string; signature: Signature; message: Message<Action> }>
	>

	public readonly as: (
		signer: SessionSigner<any>,
	) => Record<string, (...args: any[]) => Promise<{ id: string; signature: Signature; message: Message<Action> }>>

	constructor(
		readonly signer: SessionSigner,
		readonly host: string,
		readonly topic: string,
	) {
		this.actions = new Proxy(
			{},
			{
				get:
					(target, prop: string) =>
					(...args: any[]) =>
						this.sendAction(prop, args),
			},
		)

		this.as = (signer) =>
			new Proxy(
				{},
				{
					get:
						(target, prop: string) =>
						(...args: any[]) =>
							this.sendAction(prop, args, { signer }),
				},
			)
	}

	private async getClock(): Promise<{ clock: number; parents: string[] }> {
		const res = await fetch(`${this.host}/api/clock`)
		if (res.status !== StatusCodes.OK) {
			const message = await res.text()
			throw new Error(`failed to get clock from server: ${message}`)
		}
		return await res.json()
	}

	private async sendAction(
		name: string,
		args: any[],
		options: { signer?: SessionSigner } = {},
	): Promise<{ id: string; signature: Signature; message: Message<Action> }> {
		const timestamp = Date.now()

		// first check for an existing session
		const signer = options.signer ?? this.signer
		let session = await signer.getSession(this.topic)
		if (session !== null) {
			// then check that it exists in the log and hasn't expired
			const queryParams = new URLSearchParams({
				did: session.payload.did,
				publicKey: session.signer.publicKey,
				minExpiration: timestamp.toString(),
			})

			const res = await fetch(`${this.host}/api/sessions/count?${queryParams}`)
			if (res.status !== StatusCodes.OK) {
				const message = await res.text()
				throw new Error(`failed to get session count: ${message}`)
			}

			const result: { count: number } = await res.json()
			if (result.count === 0) {
				session = null
			}
		}

		const head = await this.getClock()

		if (session === null) {
			session = await this.signer.newSession(this.topic)
			const { id: sessionId } = await this.insert(session.signer, {
				topic: this.topic,
				clock: head.clock,
				parents: head.parents,
				payload: session.payload,
			})

			head.clock += 1
			head.parents = [sessionId]
		}

		return await this.insert(session.signer, {
			topic: this.topic,
			clock: head.clock,
			parents: head.parents,
			payload: {
				type: "action",
				did: session.payload.did,
				name,
				args,
				context: { timestamp },
			},
		})
	}

	private async insert<T extends MessageType>(
		delegateSigner: Signer<T>,
		message: Message<T>,
	): Promise<{ id: string; signature: Signature; message: Message<T> }> {
		const signature = await delegateSigner.sign(message)

		const res = await fetch(`${this.host}/api/messages`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: json.stringify({ signature, message }),
		})

		if (res.status !== StatusCodes.CREATED) {
			const message = await res.text()
			throw new Error(`failed to insert message: ${message}`)
		}

		const locationHeader = res.headers.get("location")

		assert(locationHeader !== null && locationHeader.startsWith("messages/"), "invalid location header in response")
		const [_, id] = locationHeader.split("/")

		return { id, signature, message }
	}
}
