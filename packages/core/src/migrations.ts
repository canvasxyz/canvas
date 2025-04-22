import { logger } from "@libp2p/logger"
import { Config, DatabaseUpgradeAPI, ModelSchema } from "@canvas-js/modeldb"

export const namespace = "canvas"
export const version = 4

export const baseVersion = { [namespace]: version }

export async function upgrade(
	upgradeAPI: DatabaseUpgradeAPI,
	oldConfig: Config,
	oldVersion: Record<string, number>,
	newVersion: Record<string, number>,
) {
	const log = logger("canvas:core:upgrade")
	const version = oldVersion[namespace] ?? 0
	log("found canvas version %d", version)

	let replayRequired = false

	if (version <= 1) {
		log("removing property 'branch' from $effects", version)
		await upgradeAPI.removeProperty("$effects", "branch")
	}

	if (version <= 2) {
		const effectsModel = {
			$writes: {
				$primary: "record_id/message_id",
				$indexes: ["record_id/csx/message_id", "message_id/record_id/csx"],
				record_id: "string",
				value: "bytes",
				message_id: "string",
				csx: "integer?",
			},

			$reads: {
				$primary: "reader_id/record_id",
				$indexes: ["record_id/csx/reader_id"],
				record_id: "string",
				reader_id: "string",
				writer_id: "string",
				csx: "integer",
			},

			$reverts: {
				$primary: "cause_id/effect_id",
				$indexes: ["effect_id/cause_id"],
				effect_id: "string",
				cause_id: "string",
			},

			$records: {
				$indexes: ["model/key"],
				record_id: "primary",
				model: "string",
				key: "string",
				version: "string",
			},
		}

		for (const [modelName, modelInit] of Object.entries(effectsModel)) {
			log("creating model %s", modelName)
			await upgradeAPI.createModel(modelName, modelInit)
		}

		log("deleting model %s", "$effects")
		await upgradeAPI.deleteModel("$effects")

		replayRequired = true
	}

	if (version <= 3) {
		log("removing index '$writes' -> 'message_id/record_id/csx'")
		await upgradeAPI.removeIndex("$writes", "message_id/record_id/csx")
	}

	return replayRequired
}

export const initialUpgradeVersion = { [namespace]: 1 }
export const initialUpgradeSchema = {
	$sessions: {
		message_id: "primary",
		did: "string",
		public_key: "string",
		address: "string",
		expiration: "integer?",
		$indexes: ["did", "public_key"],
	},
	$actions: {
		message_id: "primary",
		did: "string",
		name: "string",
		timestamp: "integer",
		$indexes: ["did", "name"],
	},
	$effects: {
		key: "primary",
		value: "bytes?",
		branch: "integer",
		clock: "integer",
	},
	$dids: {
		did: "primary",
	},
} satisfies ModelSchema
