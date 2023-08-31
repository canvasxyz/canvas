import { AbstractMessageLog, MessageLogInit } from "../AbstractStore.js"

export * from "../AbstractStore.js"

export default async function openMessageLog<Payload, Result>(
	init: MessageLogInit<Payload, Result>
): Promise<AbstractMessageLog<Payload, Result>> {
	throw new Error("unsupported platform")
}
