import type { AbstractModelDB, ModelSchema } from "@canvas-js/modeldb"

export type BranchMergeRecord = {
	source_branch: number
	source_message_id: string
	source_clock: number
	target_branch: number
	target_message_id: string
	target_clock: number
}

export class BranchMergeIndex {
	public static schema = {
		$branch_merges: {
			id: "primary",
			source_branch: "integer",
			source_message_id: "string",
			source_clock: "integer",
			target_branch: "integer",
			target_message_id: "string",
			target_clock: "integer",
		},
	} satisfies ModelSchema

	constructor(private readonly db: AbstractModelDB) {}

	public async insertBranchMerge(record: BranchMergeRecord) {
		const id = `${record.source_branch}:${record.source_clock}:${record.target_branch}:${record.target_clock}`
		await this.db.set("$branch_merges", { id, ...record })
	}
}
