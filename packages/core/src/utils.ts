import AggregateError from "aggregate-error"
import { CodeError } from "@libp2p/interface"
import { anySignal } from "any-signal"
import { Action, Message, Session, Snapshot } from "@canvas-js/interfaces"

export const isAction = (message: Message<Action | Session | Snapshot>): message is Message<Action> =>
	message.payload.type === "action"

export const isSession = (message: Message<Action | Session | Snapshot>): message is Message<Session> =>
	message.payload.type === "session"

export const isSnapshot = (message: Message<Action | Session | Snapshot>): message is Message<Snapshot> =>
	message.payload.type === "snapshot"

export const topicPattern = /^[a-zA-Z0-9.-]+$/

export function getErrorMessage(err: unknown): string {
	if (err instanceof Error && err.name === "AggregateError") {
		const { errors } = err as AggregateError
		return errors.map(getErrorMessage).join("; ")
	} else if (err instanceof CodeError) {
		return `${err.code}: ${err.message}`
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
