import test from "ava"

import { Contract } from "@canvas-js/core/contract"
import { Canvas, ModelSchema } from "@canvas-js/core"

test("link and unlink database items", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
		static topic = "com.example.app"

		static models = {
			game: { id: "primary", player: "@player[]", manager: "@player[]", observers: "@player[]", status: "json" },
			player: { id: "primary", game: "@game", status: "json" },
		} satisfies ModelSchema

		async createGame() {
			await this.db.transaction(async () => {
				const gameId = "0"
				await this.db.set("game", { id: gameId, player: [], manager: [], observers: [], status: null })
				await this.db.set("player", { id: "1", game: gameId, status: "ALIVE" })
				await this.db.link("game.player", gameId, "1")
				await this.db.set("player", { id: "2", game: gameId, status: "ALIVE" })
				await this.db.link("game.manager", gameId, "2")
				await this.db.set("player", { id: "3", game: gameId, status: "ALIVE" })
				await this.db.link("game.observers", gameId, "3")
				await this.db.set("player", { id: "4", game: gameId, status: "ALIVE" })
				await this.db.link("game.observers", gameId, "4")
			})
		}

		async unlinkGame() {
			await this.db.transaction(async () => {
				const gameId = "0"
				await this.db.unlink("game.observers", gameId, "4")
			})
		}
	}

	const app = await Canvas.initialize({
		contract: MyApp,
	})

	t.teardown(() => app.stop())

	await app.actions.createGame()

	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		player: ["1"],
		manager: ["2"],
		observers: ["3", "4"],
		status: null,
	})
	t.deepEqual(await app.db.get("player", "1"), {
		id: "1",
		game: "0",
		status: "ALIVE",
	})

	await app.actions.unlinkGame()
	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		player: ["1"],
		manager: ["2"],
		observers: ["3"],
		status: null,
	})
})

test("link and unlink database items in a string contract", async (t) => {
	const app = await Canvas.initialize({
		contract: `
		import { Contract } from "@canvas-js/core/contract"

		export default class extends Contract {
			static topic = "com.example.app"
			static models = {
				game: { id: "primary", player: "@player[]", manager: "@player[]", observers: "@player[]", status: "json" },
				player: { id: "primary", game: "@game", status: "json" },
			}
			async createGame() {
			await this.db.transaction(async () => {
					const gameId = "0"
					await this.db.set("game", { id: gameId, player: [], manager: [], observers: [], status: null })
					await this.db.set("player", { id: "1", game: gameId, status: "ALIVE" })
					await this.db.link("game.player", gameId, "1")
					await this.db.set("player", { id: "2", game: gameId, status: "ALIVE" })
					await this.db.link("game.manager", gameId, "2")
					await this.db.set("player", { id: "3", game: gameId, status: "ALIVE" })
					await this.db.link("game.observers", gameId, "3")
					await this.db.set("player", { id: "4", game: gameId, status: "ALIVE" })
					await this.db.link("game.observers", gameId, "4")
			})
			}
			async unlinkGame() {
			await this.db.transaction(async () => {
					const gameId = "0"
					await this.db.unlink("game.observers", gameId, "4")
			})
			}
		}`,
	})

	t.teardown(() => app.stop())

	await app.actions.createGame()

	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		player: ["1"],
		manager: ["2"],
		observers: ["3", "4"],
		status: null,
	})
	t.deepEqual(await app.db.get("player", "1"), {
		id: "1",
		game: "0",
		status: "ALIVE",
	})

	await app.actions.unlinkGame()
	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		player: ["1"],
		manager: ["2"],
		observers: ["3"],
		status: null,
	})
})
