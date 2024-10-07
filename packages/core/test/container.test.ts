"use closure"

import test from "ava"
import { Canvas } from "@canvas-js/core"

type FnArgument = any
type FnImplementation = (this: Canvas, ...args: Array<FnArgument>) => Promise<any>

const GLOBAL_ID = "0"

const createGame: FnImplementation = async function (db) {
	await db.set("game", {
		id: GLOBAL_ID,
		state: { started: false, player1: "foo", player2: "bar" } as any,
		label: "foobar",
	})
}

const updateGame: FnImplementation = async function (db) {
	await db.merge("game", {
		id: GLOBAL_ID,
		state: { started: true } as any,
		label: "foosball",
	})
}

const updateGameMultipleMerges: FnImplementation = async function (db) {
	await db.merge("game", { id: "0", state: { extra1: { a: 1, b: 1 } } as any })
	await db.merge("game", { id: "0", state: { extra2: "b" } as any })
	await db.merge("game", { id: "0", state: { extra3: null, extra1: { b: 2, c: 3 } } as any })
}

test("merge into a value set by another action", async (t) => {
	const app = await Canvas.initializeContainer({
		connection: { topic: "example.com", url: "https://my-app-replicator.canvas.xyz" },
		models: {
			game: { id: "primary", state: "json", label: "string" },
		},
		actions: {
			createGame,
			updateGame,
			updateGameMultipleMerges,
		},
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
})
