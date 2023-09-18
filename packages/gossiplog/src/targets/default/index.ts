import { AbstractMessageLog, MessageLogInit } from "../../AbstractMessageLog.js"

export * from "../../AbstractMessageLog.js"

export default async function openMessageLog<Payload, Result>(
	init: MessageLogInit<Payload, Result>
): Promise<AbstractMessageLog<Payload, Result>> {
	throw new Error("unsupported platform")
}
