import type { Actions, ModelSchema } from "@canvas-js/core"

export const models = {
	documents: {
		id: "primary",
		content: "yjs-doc",
	},
} satisfies ModelSchema

export const actions = {
	async applyDeltaToDoc(db, delta) {
		await db.ytext.applyDelta("documents", "0", delta)
	},
} satisfies Actions<typeof models>
