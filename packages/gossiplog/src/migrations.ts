import { toString } from "uint8arrays"
import { logger } from "@libp2p/logger"
import * as cbor from "@ipld/dag-cbor"
import * as json from "@ipld/dag-json"
import { hashEntry } from "@canvas-js/okra"

import { Config, DatabaseUpgradeAPI, ModelSchema, RangeExpression } from "@canvas-js/modeldb"
import { Message, Signature } from "@canvas-js/interfaces"
import { assert, JSONValue } from "@canvas-js/utils"

import { SignedMessage } from "./SignedMessage.js"

export const namespace = "gossiplog"
export const version = 5

export const baseVersion = { [namespace]: version }

export async function upgrade(
	upgradeAPI: DatabaseUpgradeAPI,
	oldConfig: Config,
	oldVersion: Record<string, number>,
	newVersion: Record<string, number>,
): Promise<boolean> {
	let replayRequired = false
	const log = logger("canvas:gossiplog:upgrade")

	const version = oldVersion[namespace] ?? 0
	log("found gossiplog version %d", version)

	if (version <= 1) {
		log("removing index 'branch' from $messages")
		await upgradeAPI.removeIndex("$messages", "branch")
		log("removing index 'property' from $messages")
		await upgradeAPI.removeProperty("$messages", "branch")
		log("deleting model $branch_merges")
		await upgradeAPI.deleteModel("$branch_merges")
	}

	if (version <= 2) {
		log("creating model $replays")
		await upgradeAPI.createModel("$replays", {
			timestamp: "primary",
			cursor: "string?",
			$indexes: ["cursor"],
		})
	}

	if (version <= 3) {
		log("deleting model $ancestors")
		await upgradeAPI.deleteModel("$ancestors")

		log("creating model $ancestors")
		await upgradeAPI.createModel("$ancestors", {
			$primary: "key/clock",
			key: "bytes",
			clock: "integer",
			links: "bytes",
		})

		replayRequired = true
	}

	if (version <= 4) {
		log("adding property $messages/data")
		await upgradeAPI.addProperty("$messages", "data", "bytes", cbor.encode(null))

		log("encoding messages into $messages/data")

		type MessageRecord = { id: string; signature: JSONValue; message: JSONValue; clock: number; hash: string }
		const pageSize = 128

		const lowerBound: RangeExpression = { gt: undefined }
		let results: MessageRecord[]
		let cursorClock = 0
		do {
			log("fetching new page")

			results = await upgradeAPI.query<MessageRecord>("$messages", {
				orderBy: { id: "asc" },
				where: { id: lowerBound },
				limit: pageSize,
			})

			log("got new page of %d records >= %s (clock %d)", results.length, lowerBound.gt, cursorClock)

			for (const { id, signature, message } of results) {
				// This is necessary because  we used dag-json for encoding
				// JSON properties in the initial versions of modeldb.
				// Now that we've switched to JSON.parse, we need to round-trip
				// through dag-json again so that bytes parse as Uint8Arrays.
				const signatureBytes: Uint8Array = json.encode(signature)
				const messageBytes: Uint8Array = json.encode(message)
				const signedMessage = SignedMessage.encode(
					json.decode<Signature>(signatureBytes),
					json.decode<Message>(messageBytes),
				)

				assert(signedMessage.id === id, "internal error - expected signedMessage.id === id")
				const clock = signedMessage.message.clock
				const hash = toString(hashEntry(signedMessage.key, signedMessage.value), "hex")
				await upgradeAPI.set("$messages", { id, signature, message, data: signedMessage.value, clock, hash })
				lowerBound.gt = id
				cursorClock = clock
			}
		} while (results.length > 0)

		log("finished re-encoding messages")

		log("removing property $messages/signature")
		await upgradeAPI.removeProperty("$messages", "signature")

		log("removing property $messages/message")
		await upgradeAPI.removeProperty("$messages", "message")
	}

	return replayRequired
}

export const initialUpgradeVersion = { [namespace]: 1 }

export const initialUpgradeSchema = {
	$messages: {
		id: "primary",
		signature: "json",
		message: "json",
		hash: "string",
		clock: "integer",
		branch: "integer",
		$indexes: ["clock", "branch"],
	},
	$heads: { id: "primary" },
	$ancestors: { id: "primary", links: "json" },
	$branch_merges: {
		id: "primary",
		source_branch: "integer",
		source_clock: "integer",
		source_message_id: "string",
		target_branch: "integer",
		target_clock: "integer",
		target_message_id: "string",
	},
} satisfies ModelSchema
