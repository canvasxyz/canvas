import type { ModelValue, ModelValueWithIncludes } from "@canvas-js/modeldb"

import { testPlatforms } from "./utils.js"

testPlatforms("subscriptions", async (t, openDB) => {
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

testPlatforms("subscriptions (filtering on model and query)", async (t, openDB) => {
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

testPlatforms(
	"subscriptions (with include query param)",
	async (t, openDB) => {
		const db = await openDB(t, {
			game: { gameId: "primary", levels: "@level[]", player: "@player[]" },
			level: { levelId: "primary", item: "@item[]" },
			item: { itemId: "primary", location: "json", content: "string", player: "@player" },
			player: { id: "primary" },
		})

		const changes: { results: ModelValue[] | ModelValueWithIncludes[] }[] = []
		const { id, results } = db.subscribe(
			"game",
			{
				include: {
					levels: {
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

		await db.set("game", { gameId: "0000-01", levels: ["level-01", "level-02"], player: ["alice", "bob"] })

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
						levels: [
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
						levels: [
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
	{ idb: true },
)

testPlatforms(
	"subscriptions with nested include fields",
	async (t, openDB) => {
		const db = await openDB(t, {
			author: {
				id: "primary",
				name: "string",
			},
			post: {
				id: "primary",
				title: "string",
				content: "string",
				author: "@author",
			},
			comment: {
				id: "primary",
				text: "string",
				post: "@post",
				author: "@author",
			},
		})

		// Create test data
		await db.set("author", { id: "author1", name: "Alice" })
		await db.set("author", { id: "author2", name: "Bob" })

		await db.set("post", {
			id: "post1",
			title: "First Post",
			content: "Hello world!",
			author: "author1",
		})

		// Setup subscription with nested includes
		const changes: { results: ModelValue[] | ModelValueWithIncludes[] }[] = []
		const { id, results } = db.subscribe(
			"comment",
			{
				include: {
					post: {
						author: {},
					},
					author: {},
				},
			},
			(results) => {
				changes.push({ results })
			},
		)

		t.teardown(() => db.unsubscribe(id))
		await results

		await db.set("comment", {
			id: "comment1",
			text: "Great post!",
			post: "post1",
			author: "author2",
		})

		t.is(changes.length, 2) // Initial empty state + comment added

		t.is(changes[0].results.length, 0)

		const commentResults = changes[1].results as ModelValueWithIncludes[]
		t.is(commentResults.length, 1)

		t.deepEqual(commentResults[0].author, { id: "author2", name: "Bob" })

		t.truthy(commentResults[0].post)
		const post = commentResults[0].post as ModelValueWithIncludes
		t.is(post.id, "post1")

		t.deepEqual(post.author, { id: "author1", name: "Alice" })
	},
	{ idb: true },
)
