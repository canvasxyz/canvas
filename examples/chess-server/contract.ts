import type { Contract } from "@canvas-js/core"
import { Chess } from "./deps/chess.js"

export const models: Contract["models"] = {
	boards: {
		id: "primary",
		fen: "string",
	},
}

export const actions: Contract["actions"] = {
	move: async (db, { from, to }: { from: string; to: string }) => {
		const chess = Chess((await db.get("boards", "0"))?.fen || Chess().fen())
		const move = chess.move({ from, to, promotion: "q" })
		if (move === null) throw new Error("invalid")
		await db.set("boards", { id: "0", fen: chess.fen() })
	},
	reset: async (db) => {
		await db.set("boards", { id: "0", fen: Chess().fen() })
	},
}
