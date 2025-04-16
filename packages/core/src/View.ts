import { logger } from "@libp2p/logger"
import type { MessageType } from "@canvas-js/interfaces"

import { ModelValue, PrimaryKeyValue } from "@canvas-js/modeldb"
import { AbstractGossipLog, MessageId, MIN_MESSAGE_ID } from "@canvas-js/gossiplog"
import { assert } from "@canvas-js/utils"

import { RevertRecord, WriteRecord } from "./runtime/AbstractRuntime.js"
import { decodeRecordValue, getRecordId } from "./utils.js"

export type TransactionalRead<T extends ModelValue = ModelValue> = {
	version: string
	value: T | null
	csx: number
}

export class View {
	public readonly root: MessageId[]

	protected readonly log = logger("canvas:runtime:context")
	protected readonly rootIds: string[]
	protected readonly greatestRoot: string

	constructor(public readonly messageLog: AbstractGossipLog<MessageType>, root: string[] | MessageId[]) {
		this.root = root.map((id) => (typeof id === "string" ? MessageId.encode(id) : id))
		this.rootIds = this.root.map((id) => id.toString())
		this.rootIds.sort()
		this.greatestRoot = this.rootIds[this.rootIds.length - 1]
	}

	public get db() {
		return this.messageLog.db
	}

	public async isAncestor(ancestor: string | MessageId): Promise<boolean> {
		return await this.messageLog.isAncestor(this.root, ancestor)
	}

	public async getLastValueTransactional<T extends ModelValue>(
		model: string,
		key: PrimaryKeyValue | PrimaryKeyValue[],
		recordId: string = getRecordId(model, key),
		reverted?: Set<string>,
	): Promise<TransactionalRead<T> | null> {
		let [csx, messageId] = await this.getLatestConflictSet(recordId)
		if (csx === null || messageId === null) {
			return null
		}

		this.log.trace("got latest conflict set [%d, %s] w/r/t roots %s", csx, messageId, this.rootIds)

		// this iterates backward over the greatest element of each conflict set
		// and returns the value of the first non-reverted write.
		// eslint-disable-next-line no-constant-condition
		while (true) {
			let isReverted = reverted?.has(messageId)
			isReverted ??= await this.isReverted(messageId)
			this.log.trace("isReverted(%s): %o", messageId, isReverted)
			if (!isReverted) {
				const write = await this.db.get<WriteRecord>("$writes", [recordId, messageId])
				assert(write !== null, "internal error - missing write record")
				const value = decodeRecordValue<T>(this.db.config, model, write.value)
				this.log.trace("returning write value %o", value)
				return { version: messageId, value, csx }
			} else if (csx > 1) {
				csx -= 1
				messageId = await this.getGreatestElement(recordId, csx)
				assert(messageId !== null, "internal error - failed to get greatest element")
				this.log.trace("got previous conflict set %d (%s)", csx, messageId)
			} else {
				return null
			}
		}
	}

	public async getLastValue(recordId: string): Promise<WriteRecord | null> {
		const lowerBound = MIN_MESSAGE_ID
		const upperBound = this.greatestRoot
		for await (const write of this.db.iterate<WriteRecord>("$writes", {
			where: { record_id: recordId, message_id: { gte: lowerBound, lte: upperBound } },
			orderBy: { "record_id/message_id": "desc" },
		})) {
			const isAncestor = await this.isAncestor(write.message_id)
			if (isAncestor) {
				return write
			}
		}

		return null
	}

	/** this returns the greatest element of the most recent conflict set, not considering revert status */
	public async getLatestConflictSet(recordId: string): Promise<[csx: number | null, greatestElementId: string | null]> {
		this.log.trace("getting latest csx for record %s w/r/t roots", recordId, this.rootIds)

		type Write = { record_id: string; message_id: string; csx: number | null }

		let baseWrite: Write | null = null

		// TODO: add { lte: max(this.rootIds) } condition?
		for await (const write of this.db.iterate<Write>("$writes", {
			select: { record_id: true, message_id: true, csx: true },
			where: { record_id: recordId },
			orderBy: { "record_id/message_id": "desc" },
		})) {
			if (write.csx === null) {
				continue
			}

			const isAncestor = await this.isAncestor(write.message_id)
			if (!isAncestor) {
				continue
			}

			// we call the first write we encounter the "base write"
			baseWrite = write
			break
		}

		this.log.trace("got base write %o", baseWrite)
		if (baseWrite === null) {
			return [null, null]
		}

		assert(baseWrite.csx !== null, "internal error - expected baseWrite.csx !== null")

		// the base write is *probably* the final result, but we still have to check
		// for other 'intermediate' messages descending from other members
		// of base write's conflict set that are also ancestors, since they
		// would be members of a greater conflict set

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const next = await this.getGreatestElement(recordId, baseWrite.csx + 1)
			this.log.trace("checking next CS %d and got id %s", baseWrite.csx + 1, next)
			if (next === null) {
				return [baseWrite.csx, baseWrite.message_id]
			} else {
				baseWrite.csx += 1
				baseWrite.message_id = next
			}
		}
	}

	/** get the greatest element of a conflict set, not considering revert status */
	public async getGreatestElement(recordId: string, csx: number): Promise<string | null> {
		assert(csx >= 0, "expected csx >= 0")

		// TODO: add { lte: max(this.rootIds) } condition?
		for await (const write of this.db.iterate<{ record_id: string; message_id: string; csx: number }>("$writes", {
			select: { record_id: true, message_id: true, csx: true },
			where: { record_id: recordId, csx },
			orderBy: { "record_id/csx/message_id": "desc" },
		})) {
			const isAncestor = await this.isAncestor(write.message_id)
			if (!isAncestor) {
				continue
			}

			return write.message_id
		}

		return null
	}

	public async isReverted(messageId: string): Promise<boolean> {
		this.log.trace("isReverted(%s)", messageId)

		const revertCauses = await this.db.query<RevertRecord>("$reverts", { where: { effect_id: messageId } })
		for (const revert of revertCauses) {
			const isAncestor = await this.isAncestor(revert.cause_id)
			if (isAncestor) {
				return true
			}
		}

		return false
	}
}
