import assert from "node:assert"
import test from "ava"

import { Canvas } from "@canvas-js/core"

const id = () => Math.random().toString().slice(2, 10)

test("link and unlink database items", async (t) => {
	const app = await Canvas.initialize({
		topic: "com.example.app",
		contract: {
			models: {
				game: { id: "primary", player: "@players[]", manager: "@player[]", observers: "@player[]", status: "json" },
				player: { id: "primary", game: "@game", status: "json" },
			},
			actions: {
				async createGame(db: any) {
					const gameId = "0"
					db.create("game", { id: gameId, player: [], manager: [], observers: [], status: "GAME_START" })
					db.create("player", { id: "1", game: gameId, status: "ALIVE" }).link("game", gameId)
					db.create("player", { id: "2", game: gameId, status: "ALIVE" }).link("game", gameId, { through: "manager" })
					db.create("player", { id: "3", game: gameId, status: "ALIVE" }).link("game", gameId, { through: "observers" })
					db.create("player", { id: "4", game: gameId, status: "ALIVE" })
					db.select("player", "4").link("game", gameId, { through: "observers" })
				},
				async unlinkGame(db: any) {
					const gameId = "0"
					db.select("player", "4").unlink("game", gameId, { through: "observers" })
				},
			},
		},
	})

	t.teardown(() => app.stop())

	await app.actions.createGame()

	const game_0 = await app.db.get("game", "0")
	delete game_0!["$indexed_at"]
	t.deepEqual(game_0, {
		id: "0",
		player: ["1"],
		manager: ["2"],
		observers: ["3", "4"],
		status: "GAME_START",
	})
	const player_1 = await app.db.get("player", "1")
	delete player_1!["$indexed_at"]
	t.deepEqual(player_1, {
		id: "1",
		game: "0",
		status: "ALIVE",
	})

	await app.actions.unlinkGame()
	const game_0_after = await app.db.get("game", "0")
	delete game_0_after!["$indexed_at"]
	t.deepEqual(game_0_after, {
		id: "0",
		player: ["1"],
		manager: ["2"],
		observers: ["3"],
		status: "GAME_START",
	})
})
