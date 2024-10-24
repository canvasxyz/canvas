import assert from "node:assert"
import test from "ava"

import { Canvas } from "@canvas-js/core"

const id = () => Math.random().toString().slice(2, 10)

test("link database items", async (t) => {
	const app = await Canvas.initialize({
		topic: "com.example.app",
		contract: {
			models: {
				game: { id: "primary", player: "@players[]", status: "json" },
				player: { id: "primary", game: "@game", status: "json" },
			},
			actions: {
				async createGame(db: any) {
					const gameId = "0"
					const playerId = "1"
					db.create("game", { id: gameId, player: [], status: "GAME_START" })
					db.create("player", { id: playerId, game: gameId, status: "ALIVE" }).link("game", gameId)
				},
			},
		},
	})

	t.teardown(() => app.stop())

	await app.actions.createGame()

	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		player: ["1"],
		status: "GAME_START",
	})
	t.deepEqual(await app.db.get("player", "1"), {
		id: "1",
		game: "0",
		status: "ALIVE",
	})
})
