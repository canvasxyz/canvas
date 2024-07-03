import type { AbstractModelDB, ModelsInit } from "@canvas-js/modeldb"

type BranchMergeEntry = {
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
	} satisfies ModelsInit

	constructor(private readonly db: AbstractModelDB) {}

	public async insertBranchMerge(entry: BranchMergeEntry) {
		const id = `${entry.source_branch}:${entry.source_message_id}:${entry.target_branch}:${entry.target_message_id}`
		await this.db.set("$branch_merges", { id, ...entry })
	}
}
