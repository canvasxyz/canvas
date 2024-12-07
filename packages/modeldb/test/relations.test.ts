import { nanoid } from "nanoid"
import { testOnModelDB } from "./utils.js"

testOnModelDB(
	"set, get, and delete reference and relation values",
	async (t, openDB) => {
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

		t.is(await db.count("user"), 2)

		const roomId = nanoid()
		await db.set("room", { id: roomId, creator: "a", members: ["a", "b"] })
		t.deepEqual(await db.get("room", roomId), { id: roomId, creator: "a", members: ["a", "b"] })

		await db.delete("user", "a")
		t.deepEqual(await db.get("room", roomId), { id: roomId, creator: "a", members: ["b"] })
	},
	{ sqliteWasm: false, sqlite: false, idb: true, pg: false, do: false, expo: false },
	// 	{ sqliteWasm: true, sqlite: true, idb: true, pg: true, do: true, expo: true },
)

// testOnModelDB("select reference and relation values", async (t, openDB) => {
// 	const db = await openDB(t, {
// 		user: { address: "primary" },
// 		room: {
// 			id: "primary",
// 			creator: "@user",
// 			members: "@user[]",
// 		},
// 	})

// 	await db.set("user", { address: "a" })
// 	await db.set("user", { address: "b" })
// 	await db.set("user", { address: "c" })
// 	await db.set("room", { id: "x", creator: "a", members: ["a", "b"] })
// 	await db.set("room", { id: "y", creator: "b", members: ["b", "c"] })
// 	await db.set("room", { id: "z", creator: "a", members: ["a", "c"] })

// 	t.deepEqual(await db.query("room", { select: { id: true, creator: true } }), [
// 		{ id: "x", creator: "a" },
// 		{ id: "y", creator: "b" },
// 		{ id: "z", creator: "a" },
// 	])

// 	t.deepEqual(await db.query("room", { select: { id: true, members: true } }), [
// 		{ id: "x", members: ["a", "b"] },
// 		{ id: "y", members: ["b", "c"] },
// 		{ id: "z", members: ["a", "c"] },
// 	])

// 	t.deepEqual(await db.query("room", { select: { id: true, creator: true, members: true } }), [
// 		{ id: "x", creator: "a", members: ["a", "b"] },
// 		{ id: "y", creator: "b", members: ["b", "c"] },
// 		{ id: "z", creator: "a", members: ["a", "c"] },
// 	])
// })

// testOnModelDB("query reference values", async (t, openDB) => {
// 	const db = await openDB(t, {
// 		user: { address: "primary" },
// 		room: {
// 			id: "primary",
// 			creator: "@user",
// 			members: "@user[]",
// 		},
// 	})

// 	await db.set("user", { address: "a" })
// 	await db.set("user", { address: "b" })
// 	await db.set("user", { address: "c" })
// 	await db.set("room", { id: "x", creator: "a", members: ["a", "b"] })
// 	await db.set("room", { id: "y", creator: "b", members: ["b", "c"] })
// 	await db.set("room", { id: "z", creator: "a", members: ["a", "c"] })

// 	t.deepEqual(await db.query("room", { where: { creator: "a" } }), [
// 		{ id: "x", creator: "a", members: ["a", "b"] },
// 		{ id: "z", creator: "a", members: ["a", "c"] },
// 	])

// 	t.deepEqual(await db.query("room", { where: { creator: "b" } }), [{ id: "y", creator: "b", members: ["b", "c"] }])
// 	t.deepEqual(await db.query("room", { where: { creator: "c" } }), [])
// 	t.deepEqual(await db.query("room", { where: { creator: { neq: "a" } } }), [
// 		{ id: "y", creator: "b", members: ["b", "c"] },
// 	])
// })

// testOnModelDB("query filtering on relation values", async (t, openDB) => {
// 	const db = await openDB(t, {
// 		user: { address: "primary" },
// 		room: {
// 			id: "primary",
// 			creator: "@user",
// 			members: "@user[]",
// 		},
// 	})

// 	await db.set("user", { address: "a" })
// 	await db.set("user", { address: "b" })
// 	await db.set("user", { address: "c" })
// 	await db.set("room", { id: "x", creator: "a", members: ["a", "b"] })
// 	await db.set("room", { id: "y", creator: "b", members: ["b", "c"] })
// 	await db.set("room", { id: "z", creator: "a", members: ["a", "c"] })

// 	t.deepEqual(await db.query("room", { where: { members: ["a"] } }), [
// 		{ id: "x", creator: "a", members: ["a", "b"] },
// 		{ id: "z", creator: "a", members: ["a", "c"] },
// 	])

// 	t.deepEqual(await db.query("room", { where: { members: ["b"] } }), [
// 		{ id: "x", creator: "a", members: ["a", "b"] },
// 		{ id: "y", creator: "b", members: ["b", "c"] },
// 	])

// 	t.deepEqual(await db.query("room", { where: { members: ["c"] } }), [
// 		{ id: "y", creator: "b", members: ["b", "c"] },
// 		{ id: "z", creator: "a", members: ["a", "c"] },
// 	])

// 	t.deepEqual(await db.query("room", { where: { members: ["a", "b"] } }), [
// 		{ id: "x", creator: "a", members: ["a", "b"] },
// 	])

// 	t.deepEqual(await db.query("room", { where: { members: ["b", "a"] } }), [
// 		{ id: "x", creator: "a", members: ["a", "b"] },
// 	])

// 	t.deepEqual(await db.query("room", { where: { members: ["b", "c"] } }), [
// 		{ id: "y", creator: "b", members: ["b", "c"] },
// 	])

// 	t.deepEqual(await db.query("room", { where: { members: ["c", "b"] } }), [
// 		{ id: "y", creator: "b", members: ["b", "c"] },
// 	])

// 	t.deepEqual(await db.query("room", { where: { members: ["a", "c"] } }), [
// 		{ id: "z", creator: "a", members: ["a", "c"] },
// 	])

// 	t.deepEqual(await db.query("room", { where: { members: ["c", "a"] } }), [
// 		{ id: "z", creator: "a", members: ["a", "c"] },
// 	])

// 	t.deepEqual(await db.query("room", { where: { members: ["a", "b", "c"] } }), [])

// 	t.deepEqual(await db.query("room", { where: { members: { neq: ["a"] } } }), [
// 		{ id: "y", creator: "b", members: ["b", "c"] },
// 	])

// 	t.deepEqual(await db.query("room", { where: { members: { neq: ["b"] } } }), [
// 		{ id: "z", creator: "a", members: ["a", "c"] },
// 	])

// 	t.deepEqual(await db.query("room", { where: { members: { neq: ["c"] } } }), [
// 		{ id: "x", creator: "a", members: ["a", "b"] },
// 	])

// 	t.deepEqual(await db.query("room", { where: { members: { neq: ["a", "b"] } } }), [])
// 	t.deepEqual(await db.query("room", { where: { members: { neq: ["b", "c"] } } }), [])
// 	t.deepEqual(await db.query("room", { where: { members: { neq: ["a", "c"] } } }), [])
// })

// testOnModelDB(
// 	"select nested reference and relation values (without include)",
// 	async (t, openDB) => {
// 		const db = await openDB(t, {
// 			game: { id: "primary", player: "@player[]", city: "@city[]", unit: "@unit[]" },
// 			player: { id: "primary", game: "@game", city: "@city[]", unit: "@unit[]" },
// 			city: { id: "primary", player: "@player" },
// 			unit: { id: "primary", player: "@player" },
// 		})

// 		await db.set("game", { id: "game", player: [], city: [], unit: [] })

// 		await db.set("player", { id: "alice", game: "game", city: [], unit: [] })
// 		await db.set("player", { id: "bob", game: "game", city: [], unit: [] })
// 		await db.update("game", { id: "game", player: ["alice", "bob"], city: [], unit: [] })

// 		await db.set("city", { id: "london", game: "game", player: "alice" })
// 		await db.set("city", { id: "paris", game: "game", player: "bob" })
// 		await db.update("game", { id: "game", city: ["london", "paris"] })
// 		await db.update("player", { id: "alice", city: ["london"] })
// 		await db.update("player", { id: "bob", city: ["paris"] })

// 		await db.set("unit", { id: "unit1", game: "game", city: "london", player: "alice" })
// 		await db.set("unit", { id: "unit2", game: "game", city: "london", player: "alice" })
// 		await db.set("unit", { id: "unit3", game: "game", city: "paris", player: "bob" })
// 		await db.set("unit", { id: "unit4", game: "game", city: "paris", player: "bob" })
// 		await db.set("unit", { id: "unit5", game: "game", city: null, player: "bob" })
// 		await db.update("player", { id: "alice", unit: ["unit1", "unit2"] })
// 		await db.update("player", { id: "bob", unit: ["unit3", "unit4", "unit5"] })
// 		await db.update("city", { id: "london", unit: ["unit1", "unit2"] })
// 		await db.update("city", { id: "paris", unit: ["unit3", "unit4"] })
// 		await db.update("game", { id: "game", unit: ["unit1", "unit2", "unit3", "unit4", "unit5"] })

// 		t.deepEqual(await db.query("game", { select: { id: true, player: true, city: true, unit: true } }), [
// 			{
// 				id: "game",
// 				player: ["alice", "bob"],
// 				city: ["london", "paris"],
// 				unit: ["unit1", "unit2", "unit3", "unit4", "unit5"],
// 			},
// 		])

// 		await t.throwsAsync(async () => {
// 			await db.query("game", {
// 				include: {
// 					player: {
// 						unit: {
// 							player: {},
// 						},
// 					},
// 					city: {
// 						player: {},
// 					},
// 				},
// 				where: { id: "game" },
// 			})
// 		})
// 	},
// 	{ sqliteWasm: true, sqlite: true, idb: false, pg: true, do: true, expo: true },
// )

// testOnModelDB(
// 	"select nested reference and relation values (with include)",
// 	async (t, openDB) => {
// 		const db = await openDB(t, {
// 			game: { id: "primary", player: "@player[]", city: "@city[]", unit: "@unit[]" },
// 			player: { id: "primary", game: "@game", city: "@city[]", unit: "@unit[]" },
// 			city: { id: "primary", player: "@player" },
// 			unit: { id: "primary", player: "@player", city: "@city?" },
// 		})

// 		await db.set("game", { id: "game", player: [], city: [], unit: [] })

// 		await db.set("player", { id: "alice", game: "game", city: [], unit: [] })
// 		await db.set("player", { id: "bob", game: "game", city: [], unit: [] })
// 		await db.update("game", { id: "game", player: ["alice", "bob"], city: [], unit: [] })

// 		await db.set("city", { id: "london", game: "game", player: "alice" })
// 		await db.set("city", { id: "paris", game: "game", player: "bob" })
// 		await db.update("game", { id: "game", city: ["london", "paris"] })
// 		await db.update("player", { id: "alice", city: ["london"] })
// 		await db.update("player", { id: "bob", city: ["paris"] })

// 		await db.set("unit", { id: "unit1", game: "game", city: "london", player: "alice" })
// 		await db.set("unit", { id: "unit2", game: "game", city: "london", player: "alice" })
// 		await db.set("unit", { id: "unit3", game: "game", city: "paris", player: "bob" })
// 		await db.set("unit", { id: "unit4", game: "game", city: "paris", player: "bob" })
// 		await db.set("unit", { id: "unit5", game: "game", city: null, player: "bob" })
// 		await db.update("player", { id: "alice", unit: ["unit1", "unit2"] })
// 		await db.update("player", { id: "bob", unit: ["unit3", "unit4", "unit5"] })
// 		await db.update("city", { id: "london", unit: ["unit1", "unit2"] })
// 		await db.update("city", { id: "paris", unit: ["unit3", "unit4"] })
// 		await db.update("game", { id: "game", unit: ["unit1", "unit2", "unit3", "unit4", "unit5"] })

// 		t.deepEqual(
// 			await db.query("game", {
// 				include: {
// 					player: {
// 						unit: {
// 							player: {},
// 						},
// 					},
// 					city: {
// 						player: {},
// 					},
// 				},
// 				where: { id: "game" },
// 			}),
// 			[
// 				{
// 					id: "game",
// 					player: [
// 						{
// 							id: "alice",
// 							game: "game",
// 							city: ["london"],
// 							unit: [
// 								{
// 									id: "unit1",
// 									city: "london",
// 									player: { id: "alice", game: "game", city: ["london"], unit: ["unit1", "unit2"] },
// 								},
// 								{
// 									id: "unit2",
// 									city: "london",
// 									player: { id: "alice", game: "game", city: ["london"], unit: ["unit1", "unit2"] },
// 								},
// 							],
// 						},
// 						{
// 							id: "bob",
// 							game: "game",
// 							city: ["paris"],
// 							unit: [
// 								{
// 									id: "unit3",
// 									city: "paris",
// 									player: { id: "bob", game: "game", city: ["paris"], unit: ["unit3", "unit4", "unit5"] },
// 								},
// 								{
// 									id: "unit4",
// 									city: "paris",
// 									player: { id: "bob", game: "game", city: ["paris"], unit: ["unit3", "unit4", "unit5"] },
// 								},
// 								{
// 									id: "unit5",
// 									city: null,
// 									player: { id: "bob", game: "game", city: ["paris"], unit: ["unit3", "unit4", "unit5"] },
// 								},
// 							],
// 						},
// 					],
// 					city: [
// 						{
// 							id: "london",
// 							player: {
// 								id: "alice",
// 								game: "game",
// 								city: ["london"],
// 								unit: ["unit1", "unit2"],
// 							},
// 						},
// 						{
// 							id: "paris",
// 							player: {
// 								id: "bob",
// 								game: "game",
// 								city: ["paris"],
// 								unit: ["unit3", "unit4", "unit5"],
// 							},
// 						},
// 					],
// 					unit: ["unit1", "unit2", "unit3", "unit4", "unit5"],
// 				},
// 			],
// 		)
// 	},
// 	{ sqliteWasm: false, sqlite: false, idb: true, pg: false, do: false, expo: true },
// )
