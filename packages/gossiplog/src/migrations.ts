import * as cbor from "@ipld/dag-cbor"

import { Config, DatabaseUpgradeAPI, ModelSchema, RangeExpression } from "@canvas-js/modeldb"
import { logger } from "@libp2p/logger"
import { Message, Signature } from "@canvas-js/interfaces"
import { SignedMessage } from "./SignedMessage.js"
import { assert } from "@canvas-js/utils"
import { toString } from "uint8arrays"
import { hashEntry } from "@canvas-js/okra"

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

		const pageSize = 128

		const lowerBound: RangeExpression = { gt: undefined }
		let results: { id: string; signature: Signature; message: Message }[]
		do {
			log("fetching new page")
			results = await upgradeAPI.query<{ id: string; signature: Signature; message: Message }>("$messages", {
				select: { id: true, signature: true, message: true },
				orderBy: { id: "asc" },
				where: { id: lowerBound },
				limit: pageSize,
			})

			log("got new page of %d records (cursor %s)", results.length, lowerBound.gt ?? null)

			for (const { id, signature, message } of results) {
				log("re-encoding message %s", id)
				const signedMessage = SignedMessage.encode(signature, message)
				assert(signedMessage.id === id, "internal error - expected signedMessage.id === id")
				const clock = signedMessage.message.clock
				const hash = toString(hashEntry(signedMessage.key, signedMessage.value), "hex")
				await upgradeAPI.set("$messages", { id, signature, message, data: signedMessage.value, clock, hash })
				lowerBound.gt = id
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
