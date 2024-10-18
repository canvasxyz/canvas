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

test("apply container actions with db.merge", async (t) => {
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
		globals: {
			GLOBAL_ID,
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

test("apply container actions with different function syntaxes", async (t) => {
	const external = {
		testMemberFunction(db: any) {
			db.set("check", { id: "member" })
		},
		testAsyncMemberFunction(db: any) {
			db.set("check", { id: "async_member" })
		},
	}
	function testExternalFunction(db: any) {
		db.set("check", { id: "external_named" })
	}

	const app = await Canvas.initializeContainer({
		connection: { topic: "example.com", url: "https://my-app-replicator.canvas.xyz" },
		models: {
			check: { id: "primary" },
		},
		actions: {
			testArrowFunction: (db) => {
				db.set("check", { id: "arrow" })
			},
			testAsyncArrowFunction: async (db) => {
				db.set("check", { id: "async_arrow" })
			},
			testBareArrowFunction: (db) => db.set("check", { id: "bare_arrow" }),
			testAnonymousFunction: function (db) {
				db.set("check", { id: "anonymous" })
			},
			testAsyncAnonymousFunction: async function (db) {
				db.set("check", { id: "async_anonymous" })
			},
			testNamedFunction: function foo(db) {
				db.set("check", { id: "named" })
			},
			testAsyncNamedFunction: async function foo(db) {
				db.set("check", { id: "async_named" })
			},
			testExternalFunction,
			testMemberFunction: external.testMemberFunction,
			testAsyncMemberFunction: external.testAsyncMemberFunction,
		},
		globals: {
			GLOBAL_ID,
		},
	})

	t.teardown(() => app.stop())

	await app.actions.testArrowFunction()
	await app.actions.testAsyncArrowFunction()
	await app.actions.testBareArrowFunction()
	await app.actions.testAnonymousFunction()
	await app.actions.testAsyncAnonymousFunction()
	await app.actions.testNamedFunction()
	await app.actions.testAsyncNamedFunction()
	await app.actions.testExternalFunction()
	await app.actions.testMemberFunction()
	await app.actions.testAsyncMemberFunction()

	t.truthy(await app.db.get("check", "arrow"))
	t.truthy(await app.db.get("check", "async_arrow"))
	t.truthy(await app.db.get("check", "bare_arrow"))
	t.truthy(await app.db.get("check", "anonymous"))
	t.truthy(await app.db.get("check", "async_anonymous"))
	t.truthy(await app.db.get("check", "named"))
	t.truthy(await app.db.get("check", "async_named"))
	t.truthy(await app.db.get("check", "external_named"))
	t.truthy(await app.db.get("check", "member"))
	t.truthy(await app.db.get("check", "async_member"))
	t.falsy(await app.db.get("check", "nonexistent"))
})
