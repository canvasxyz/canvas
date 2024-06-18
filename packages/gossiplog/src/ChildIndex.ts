import type { AbstractModelDB, ModelsInit } from "@canvas-js/modeldb"

export class ChildIndex {
	public static schema = {
		$children: { id: "primary", childLinks: "string" },
	} satisfies ModelsInit

	constructor(private readonly db: AbstractModelDB) {}

	public async getChildren(parentId: string) {
		const childrenEntry = await this.db.get<{ id: string; childLinks: string[] }>("$children", parentId)
		return childrenEntry ? childrenEntry.childLinks : []
	}

	public async indexChild(parentId: string, childId: string) {
		const existingChildLinks = await this.getChildren(parentId)
		if (!existingChildLinks.includes(childId)) {
			await this.db.set("$children", { id: parentId, childLinks: [...existingChildLinks, childId] })
		}
	}
}
