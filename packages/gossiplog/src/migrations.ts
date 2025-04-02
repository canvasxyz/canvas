import { Config, DatabaseUpgradeAPI, ModelSchema } from "@canvas-js/modeldb"
import { logger } from "@libp2p/logger"

export const namespace = "gossiplog"
export const version = 4

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
