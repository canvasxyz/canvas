import type { AbstractModelDB, ModelsInit } from "@canvas-js/modeldb"

export class MessageBranchIndex {
	public static schema = {
		$messageBranches: { id: "primary", branch: "integer" },
		// $maxBranch is a singleton
		$maxBranch: { id: "primary", maxBranch: "integer" },
	} satisfies ModelsInit

	constructor(private readonly db: AbstractModelDB) {}

	public async setMessageBranch(messageId: string, branch: number) {
		await this.db.set("$messageBranches", { id: messageId, branch })
	}

	public async getMessageBranch(messageId: string) {
		const result = await this.db.get<{ id: string; branch: number }>("$messageBranches", messageId)
		if (result == null) {
			throw new Error(`branch not found for ${messageId}`)
		}
		return result.branch
	}

	public async allocateMaxBranch() {
		const maxBranchResult = await this.db.get<{ maxBranch: number }>("$maxBranch", "singleton")
		const maxBranch = maxBranchResult ? maxBranchResult.maxBranch : 0
		await this.db.set("$maxBranch", { id: "singleton", maxBranch: maxBranch + 1 })
		return maxBranch
	}
}
