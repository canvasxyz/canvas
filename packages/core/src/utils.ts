import AggregateError from "aggregate-error"
import { anySignal } from "any-signal"
import { bytesToHex } from "@noble/hashes/utils"
import { blake3 } from "@noble/hashes/blake3"
import { Message, Action, Session, Snapshot } from "@canvas-js/interfaces"
import { SignedMessage } from "@canvas-js/gossiplog"
import { base64 } from "multiformats/bases/base64"

export const isAction = (
	signedMessage: SignedMessage<Action | Session | Snapshot>,
): signedMessage is SignedMessage<Action> => signedMessage.message.payload.type === "action"

export const isSession = (
	signedMessage: SignedMessage<Action | Session | Snapshot>,
): signedMessage is SignedMessage<Session> => signedMessage.message.payload.type === "session"

export const isSnapshot = (
	signedMessage: SignedMessage<Action | Session | Snapshot>,
): signedMessage is SignedMessage<Snapshot> => signedMessage.message.payload.type === "snapshot"

export const topicPattern = /^[a-zA-Z0-9.-]+$/

export function getErrorMessage(err: unknown): string {
	if (err instanceof Error && err.name === "AggregateError") {
		const { errors } = err as AggregateError
		return errors.map(getErrorMessage).join("; ")
	} else if (err instanceof Error) {
		return `${err.name}: ${err.message}`
	} else {
		throw err
	}
}

export async function wait(interval: number, options: { signal: AbortSignal }) {
	if (options.signal.aborted) {
		return
	}

	const signal = anySignal([AbortSignal.timeout(interval), options.signal])
	await new Promise<Event>((resolve) => {
		signal.addEventListener("abort", resolve, { once: true })
	}).finally(() => signal.clear())
}

export function getRecordId(model: string, key: string) {
	const hash = blake3(`${model}/${key}`, { dkLen: 18 })
	return base64.baseEncode(hash)
}
