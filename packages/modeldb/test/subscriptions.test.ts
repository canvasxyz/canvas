import type { ModelValue, ModelValueWithIncludes } from "@canvas-js/modeldb"

import { testOnModelDB } from "./utils.js"

testOnModelDB("subscriptions", async (t, openDB) => {
	const db = await openDB(t, {
		user: { address: "primary" },
		room: {
			id: "primary",
			creator: "@user",
			members: "@user[]",
		},
	})

	const changes: { results: ModelValue[] | ModelValueWithIncludes[] }[] = []
	const { id, results } = db.subscribe("user", {}, (results) => {
		changes.push({ results })
	})

	t.teardown(() => db.unsubscribe(id))
	await results
	await db.set("user", { address: "a" })
	await db.set("user", { address: "b" })

	t.is(await db.count("user"), 2)
	t.deepEqual(changes, [
		{ results: [] },
		{ results: [{ address: "a" }] },
		{ results: [{ address: "a" }, { address: "b" }] },
	])
})

testOnModelDB("subscriptions (filtering on model and query)", async (t, openDB) => {
	const db = await openDB(t, {
		user: { address: "primary" },
		room: {
			id: "primary",
			creator: "@user",
			members: "@user[]",
		},
	})

	await db.set("user", { address: "a" })
	await db.set("user", { address: "b" })
	await db.set("user", { address: "c" })

	const changes: { results: ModelValue[] | ModelValueWithIncludes[] }[] = []
	const { id, results } = db.subscribe("room", { where: { creator: "a" } }, (results) => {
		changes.push({ results })
	})

	t.teardown(() => db.unsubscribe(id))

	await results

	await db.set("room", { id: "x", creator: "a", members: ["a", "b"] })
	await db.set("room", { id: "y", creator: "b", members: ["b", "c"] })
	await db.set("room", { id: "z", creator: "a", members: ["a", "c"] })
	await db.set("user", { address: "d" })
	await db.set("user", { address: "e" })

	t.deepEqual(changes, [
		{ results: [] },
		{ results: [{ id: "x", creator: "a", members: ["a", "b"] }] },
		{
			results: [
				{ id: "x", creator: "a", members: ["a", "b"] },
				{ id: "z", creator: "a", members: ["a", "c"] },
			],
		},
	])
})

testOnModelDB(
	"subscriptions (with include query param)",
	async (t, openDB) => {
		const db = await openDB(t, {
			game: { gameId: "primary", level: "@level[]", player: "@player[]" },
			level: { levelId: "primary", item: "@item[]" },
			item: { itemId: "primary", location: "json", content: "string", player: "@player" },
			player: { id: "primary" },
		})

		const changes: { results: ModelValue[] | ModelValueWithIncludes[] }[] = []
		const { id, results } = db.subscribe(
			"game",
			{
				include: {
					level: {
						item: {
							player: {},
						},
					},
					player: {},
				},
			},
			(results) => {
				changes.push({ results })
			},
		)

		t.teardown(() => db.unsubscribe(id))
		await results

		await db.set("player", { id: "alice" })
		await db.set("player", { id: "bob" })

		await db.set("item", { itemId: "item-01", location: {}, content: "frog", player: "alice" })
		await db.set("item", { itemId: "item-02", location: {}, content: "frog", player: "bob" })
		await db.set("item", { itemId: "item-03", location: {}, content: "tode", player: "bob" })

		await db.set("level", { levelId: "level-01", item: ["item-02"] })
		await db.set("level", { levelId: "level-02", item: ["item-01", "item-03"] })

		await db.set("game", { gameId: "0000-01", level: ["level-01", "level-02"], player: ["alice", "bob"] })

		await db.update("item", { itemId: "item-02", content: "tode" })

		t.is(await db.count("player"), 2)

		t.deepEqual(changes, [
			// TODO: these shouldn't fire once relations are filtered by key
			{ results: [] }, // db.set(player)
			{ results: [] }, // db.set(player)
			{ results: [] }, // db.set(item)
			{ results: [] }, // db.set(item)
			{ results: [] }, // db.set(item)
			{ results: [] }, // db.set(level)
			{ results: [] }, // db.set(level)
			{ results: [] }, // db.set(game)
			{
				results: [
					{
						gameId: "0000-01",
						level: [
							{
								levelId: "level-01",
								item: [{ itemId: "item-02", location: {}, content: "frog", player: { id: "bob" } }],
							},
							{
								levelId: "level-02",
								item: [
									{ itemId: "item-01", location: {}, content: "frog", player: { id: "alice" } },
									{ itemId: "item-03", location: {}, content: "tode", player: { id: "bob" } },
								],
							},
						],
						player: [{ id: "alice" }, { id: "bob" }],
					},
				],
			},
			{
				results: [
					{
						gameId: "0000-01",
						level: [
							{
								levelId: "level-01",
								item: [{ itemId: "item-02", location: {}, content: "tode", player: { id: "bob" } }],
							},
							{
								levelId: "level-02",
								item: [
									{ itemId: "item-01", location: {}, content: "frog", player: { id: "alice" } },
									{ itemId: "item-03", location: {}, content: "tode", player: { id: "bob" } },
								],
							},
						],
						player: [{ id: "alice" }, { id: "bob" }],
					},
				],
			},
		])
	},
	{ sqliteWasm: false, sqlite: false, idb: true, pg: false, do: false },
)
