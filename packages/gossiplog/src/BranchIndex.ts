import type { AbstractModelDB, ModelsInit } from "@canvas-js/modeldb"

export class BranchIndex {
	public static schema = {
		// $maxBranch is a singleton
		$maxBranch: { id: "primary", maxBranch: "integer" },
	} satisfies ModelsInit

	constructor(private readonly db: AbstractModelDB) {}

	public async createNewBranch() {
		const maxBranchResult = await this.db.get<{ maxBranch: number }>("$maxBranch", "singleton")
		const maxBranch = maxBranchResult ? maxBranchResult.maxBranch : 0
		await this.db.set("$maxBranch", { id: "singleton", maxBranch: maxBranch + 1 })
		return maxBranch
	}
}
