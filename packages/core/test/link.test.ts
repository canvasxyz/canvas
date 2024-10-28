import assert from "node:assert"
import test from "ava"

import { Canvas } from "@canvas-js/core"

const id = () => Math.random().toString().slice(2, 10)

test("link database items", async (t) => {
	const app = await Canvas.initialize({
		topic: "com.example.app",
		contract: {
			models: {
				game: { id: "primary", player: "@players[]", manager: "@player?", observers: "@player[]", status: "json" },
				player: { id: "primary", game: "@game", status: "json" },
			},
			actions: {
				async createGame() {
					const gameId = "0"
					this.db.create("game", { id: gameId, player: [], manager: null, observers: [], status: "GAME_START" })
					this.db.create("player", { id: "1", game: gameId, status: "ALIVE" }).link("game", gameId)
					this.db.create("player", { id: "2", game: gameId, status: "ALIVE" }).link("game", gameId, { through: "manager" })
					this.db.create("player", { id: "3", game: gameId, status: "ALIVE" }).link("game", gameId, { through: "observers" })
				},
			},
		},
	})

	t.teardown(() => app.stop())

	await app.actions.createGame()

	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		player: ["1"],
		manager: "2",
		observers: ["3"],
		status: "GAME_START",
	})
	t.deepEqual(await app.db.get("player", "1"), {
		id: "1",
		game: "0",
		status: "ALIVE",
	})
})
