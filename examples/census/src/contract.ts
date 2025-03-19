import type { Actions, ModelSchema } from "@canvas-js/core"

export const models = {
	statement: {
		id: "primary",
		text: "string",
		author: "string",
		x: "number?",
		y: "number?",
		$indexes: ["author"],
	},
	// votes: { id: "primary", statement: "@statement", value: "boolean", author: "string", $indexes: ["author"] }
} satisfies ModelSchema

export const actions = {
	async createStatement(db, text: string) {
		await db.set("statement", { id, text, author: this.address, x: null, y: null })
	},
	async moveStatement(db, id: string, x: number, y: number) {
		if ((await db.get("statement", id)).author !== this.address) throw new Error()
		await db.update("statement", { id, x, y })
	},
	// async voteStatement(db, id: string, vote: boolean) {
	// }
} satisfies Actions<typeof models>
