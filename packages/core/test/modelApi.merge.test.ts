import test from "ava"

import { Canvas, ModelSchema } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"

test("merge and update into a value set by another action", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
		static topic = "com.example.app"
		static models = {
			game: { id: "primary", state: "json", label: "string" },
		} satisfies ModelSchema

		async createGame() {
			await this.db.transaction(() =>
				this.db.set("game", {
					id: "0",
					state: { started: false, player1: "foo", player2: "bar" },
					label: "foobar",
				}),
			)
		}

		async updateGame() {
			await this.db.transaction(() =>
				this.db.merge("game", {
					id: "0",
					state: { started: true } as any,
					label: "foosball",
				}),
			)
		}

		async updateGameMultipleMerges() {
			await this.db.transaction(async () => {
				await this.db.merge("game", { id: "0", state: { extra1: { a: 1, b: 1 } } })
				await this.db.merge("game", { id: "0", state: { extra2: "b" } })
				await this.db.merge("game", { id: "0", state: { extra3: null, extra1: { b: 2, c: 3 } } })
			})
		}

		async updateGameMultipleUpdates() {
			await this.db.transaction(async () => {
				await this.db.update("game", { id: "0", state: { extra1: { a: 1, b: 2 } } })
				await this.db.update("game", { id: "0", state: { extra3: null, extra1: { b: 2, c: 3 } } })
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
		state: { started: false, player1: "foo", player2: "bar" },
		label: "foobar",
	})

	await app.actions.updateGame()
	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		state: { started: true, player1: "foo", player2: "bar" },
		label: "foosball",
	})

	await app.actions.updateGameMultipleMerges()
	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		state: {
			started: true,
			player1: "foo",
			player2: "bar",
			extra1: { a: 1, b: 2, c: 3 },
			extra2: "b",
			extra3: null,
		},
		label: "foosball",
	})

	await app.actions.updateGameMultipleUpdates()
	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		state: {
			extra3: null,
			extra1: { b: 2, c: 3 },
		},
		label: "foosball",
	})
})

test("merge and get execute in order", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
		static models = {
			test: { id: "primary", foo: "string?", bar: "string?", qux: "string?" },
		} satisfies ModelSchema

		async testMerges() {
			return await this.db.transaction(async () => {
				await this.db.set("test", { id: "0", foo: null, bar: null, qux: "foo" })
				await this.db.merge("test", { id: "0", foo: "foo", qux: "qux" })
				await this.db.merge("test", { id: "0", bar: "bar" })
				return await this.db.get("test", "0")
			})
		}

		async testGet(): Promise<any> {
			return await this.db.transaction(async () => {
				await this.db.set("test", { id: "1", foo: null, bar: null, qux: "foo" })
				const result = await this.db.get("test", "1")
				await this.db.merge("test", { id: "1", foo: "foo", qux: "qux" })
				await this.db.merge("test", { id: "1", bar: "bar" })
				return result
			})
		}
	}

	const app = await Canvas.initialize({
		contract: MyApp,
	})

	t.teardown(() => app.stop())

	await app.actions.testMerges()
	t.deepEqual(await app.db.get("test", "0"), {
		id: "0",
		foo: "foo",
		bar: "bar",
		qux: "qux",
	})

	const { result } = await app.actions.testGet()
	t.deepEqual(await app.db.get("test", "1"), {
		id: "1",
		foo: "foo",
		bar: "bar",
		qux: "qux",
	})
	t.deepEqual(result, {
		id: "1",
		foo: null,
		bar: null,
		qux: "foo",
	})
})
