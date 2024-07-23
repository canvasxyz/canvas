import { nanoid } from "nanoid"
import { OpfsModelDB } from "@canvas-js/modeldb-sqlite-wasm"
import DBWorker from "./worker.js?worker"
import { ModelValue } from "@canvas-js/modeldb"

function assert(condition: boolean, message = "Assertion failed") {
	if (!condition) {
		throw new Error(message)
	}
}

function assertDeepEqual(o1: any, o2: any) {
	assert(deepEqual(o1, o2), `${o1} is not deep equal to ${o2}`)
}

function assertIs(o1: any, o2: any) {
	assert(o1 === o2, `${o1} is not equal to ${o2}`)
}

async function expectThrown(func: () => Promise<void>, message: string) {
	let exceptionThrown = false

	try {
		await func()
	} catch (e: any) {
		exceptionThrown = true
		if (e.message !== message) {
			throw new Error(`Expected error message to be "${message}", but got "${e.message}"`)
		}
	}

	if (!exceptionThrown) {
		throw new Error("Expected an exception to be thrown, but none was thrown")
	}
}

function deepEqual(o1: any, o2: any) {
	const o1Type = typeof o1
	const o2Type = typeof o2
	if (o1Type !== o2Type) {
		return false
	} else if (o1Type === "function") {
		throw new Error("Cannot compare functions")
		// } else if (o1 instanceof Array) {
		// 	// compare all elements of o1 and o2
		// 	if (o1.length !== o2.length) {
		// 		return false
		// 	} else {
		// 		for (let i = 0; i < o1.length; i++) {
		// 			if (!deepEqual(o1[i], o2[i])) {
		// 				return false
		// 			}
		// 		}
		// 	}
	} else if (
		o1Type === "undefined" ||
		o1Type === "bigint" ||
		o1Type === "boolean" ||
		o1Type === "number" ||
		o1Type === "string" ||
		o1Type === "symbol" ||
		o1 === null ||
		o2 === null
	) {
		return o1 === o2
	} else if (o1Type === "object") {
		const keys1 = Object.keys(o1)
		const keys2 = Object.keys(o2)
		if (keys1.length !== keys2.length) {
			return false
		}
		for (const key of keys1) {
			if (!deepEqual(o1[key], o2[key])) {
				return false
			}
		}
		return true
	} else {
		throw new Error(`Unknown type: ${o1Type}`)
	}
}

const clearButton = document.getElementById("clear")!
clearButton.onclick = async () => {
	const hdl = await navigator.storage.getDirectory()
	// @ts-ignore
	for await (const [path, x] of hdl.entries()) {
		hdl.removeEntry(path)
	}
}

// this is so that we can use `waitForSelector` in puppeteer
// to check the results of the test
function done(res: any) {
	const outputElem = document.getElementById("output")
	if (outputElem) throw new Error("Output element already exists - done() has already been called!")

	// call this function when done
	const startButton = document.getElementById("start")!
	const parent = startButton.parentNode
	if (!parent) {
		throw new Error("No parent node")
	}
	const outputDiv = document.createElement("div")
	outputDiv.id = "output"
	outputDiv.innerHTML = JSON.stringify(res)
	parent.appendChild(outputDiv)
}

const startButton = document.getElementById("start")!
startButton.onclick = async () => {
	const tests = [
		test_create_modeldb_no_models,
		test_create_modeldb_model_valid_fields,
		test_create_modeldb_model_invalid_fields,
		test_create_modeldb_optional_json_fail,
		test_create_modeldb_no_primary_key_fail,
		test_create_modeldb_two_primary_keys_fail,
		test_example,
		test_query_indexed_where,
		test_query_indexed_order_by,
		test_operations_get_fields_of_all_types,
		test_operations_update_a_value,
		test_operations_delete_a_value,
		test_query_where,
		test_query_select,
		test_query_order_by,
		test_query_indexed_where,
		test_query_indexed_order_by,
		test_query_no_query_json_fields,
		test_relations_set_get_reference_and_relation_values,
		test_relations_select_reference_relation_values,
		test_relations_query_reference_values,
		test_relations_query_filtering_on_relation_values,
		test_subscriptions,
		test_subscriptions_filtering,
	]
	const results: any = {}
	let suitePassed = true

	for (const test of tests) {
		try {
			await test()
			results[test.name] = { status: "pass" }
		} catch (error: any) {
			results[test.name] = { status: "fail", message: error.message, stack: error.stack }
			suitePassed = false
		}
	}

	done({ suitePassed, results })
}

async function test_create_modeldb_no_models() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {},
	})
	db.close()
}

async function test_create_modeldb_model_valid_fields() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			room: {
				id: "primary",
				name: "string",
				isModerator: "boolean",
				creator: "@user",
				members: "@user[]",
			},
		},
	})
	db.close()
}

async function test_create_modeldb_model_invalid_fields() {
	await expectThrown(async () => {
		const db = await OpfsModelDB.initialize({
			worker: new DBWorker(),
			path: `${nanoid()}.db`,
			models: {
				room: {
					// @ts-ignore
					name: "unsupported",
				},
			},
		})
		db.close()
	}, `error defining room: invalid property "unsupported"`)
}

async function test_create_modeldb_optional_json_fail() {
	await expectThrown(async () => {
		const db = await OpfsModelDB.initialize({
			worker: new DBWorker(),
			path: `${nanoid()}.db`,
			models: {
				room: {
					// @ts-ignore
					name: "json?",
				},
			},
		})
		db.close()
	}, `error defining room: field "name" is invalid - json fields cannot be optional`)
}

async function test_create_modeldb_no_primary_key_fail() {
	await expectThrown(async () => {
		const db = await OpfsModelDB.initialize({
			worker: new DBWorker(),
			path: `${nanoid()}.db`,
			models: {
				room: {
					name: "string",
				},
			},
		})
		db.close()
	}, `error defining room: models must have exactly one "primary" property`)
}

async function test_create_modeldb_two_primary_keys_fail() {
	await expectThrown(async () => {
		const db = await OpfsModelDB.initialize({
			worker: new DBWorker(),
			path: `${nanoid()}.db`,
			models: {
				room: {
					id: "primary",
					address: "primary",
					name: "string?",
				},
			},
		})
		db.close()
	}, `error defining room: models must have exactly one "primary" property`)
}

async function test_example() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			user: {
				id: "primary",
				address: "string",
				encryptionPublicKey: "bytes",
				signingPublicKey: "bytes",
			},

			room: {
				id: "primary",
				creator: "@user",
				members: "@user[]",
				$indexes: ["members"],
			},
		},
	})
	const userA = {
		id: nanoid(),
		address: "a",
		encryptionPublicKey: new Uint8Array([1, 2, 3]),
		signingPublicKey: new Uint8Array([4, 5, 6]),
	}

	const userB = {
		id: nanoid(),
		address: "b",
		encryptionPublicKey: new Uint8Array([7, 8, 9]),
		signingPublicKey: new Uint8Array([0xa, 0xb, 0xc]),
	}

	assert((await db.count("user")) === 0, `expected 0 users, got ${await db.count("user")}`)

	await db.set("user", userA)

	assertDeepEqual(await db.get("user", userA.id), userA)
	const count1 = await db.count("user")
	assert(count1 == 1, `expected 1 user, got ${count1}`)

	await db.set("user", userB)
	assertDeepEqual(await db.get("user", userB.id), userB)
	const count2 = await db.count("user")
	assert(count2 == 2, `expected 2 users, got ${count2}`)

	const room = {
		id: nanoid(),
		creator: userA.id,
		members: [userA.id, userB.id],
	}

	await db.set("room", room)
	assertDeepEqual(await db.get("room", room.id), room)
	const roomCount = await db.count("room")
	assert(roomCount === 1, `expected 1 room, got ${roomCount}`)

	db.close()
}

async function test_query_indexed_where() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			user: { address: "primary", name: "string?", $indexes: ["address", "name"] },
		},
	})

	await db.set("user", { address: "a", name: "John Doe" })
	await db.set("user", { address: "b", name: null })
	await db.set("user", { address: "c", name: "Jane Doe" })

	// Equality
	assertDeepEqual(await db.query("user", { where: { address: "a" } }), [{ address: "a", name: "John Doe" }])
	assertDeepEqual(await db.query("user", { where: { name: "John Doe" } }), [{ address: "a", name: "John Doe" }])
	assertDeepEqual(await db.query("user", { where: { name: null } }), [{ address: "b", name: null }])

	// Negation
	assertDeepEqual(await db.query("user", { where: { name: { neq: "John Doe" } }, orderBy: { name: "asc" } }), [
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])

	assertDeepEqual(await db.query("user", { where: { name: { neq: null } }, orderBy: { name: "asc" } }), [
		{ address: "c", name: "Jane Doe" },
		{ address: "a", name: "John Doe" },
	])

	assertDeepEqual(await db.query("user", { where: { address: { neq: "c" } } }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
	])

	// Range
	assertDeepEqual(await db.query("user", { where: { address: { gte: "a" } } }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])
	assertDeepEqual(await db.query("user", { where: { address: { gt: "a" } } }), [
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])
	assertDeepEqual(await db.query("user", { where: { address: { gt: "a", lt: "c" } } }), [{ address: "b", name: null }])
	assertDeepEqual(await db.query("user", { where: { address: { gt: "a", lte: "c" } } }), [
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])
	assertDeepEqual(await db.query("user", { where: { address: { gte: "a", lt: "c" } } }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
	])

	// Multiple filters
	assertDeepEqual(await db.query("user", { where: { name: { neq: null }, address: { gt: "a" } } }), [
		{ address: "c", name: "Jane Doe" },
	])

	assertDeepEqual(await db.query("user", { where: { address: { lte: "b" }, name: { gt: null } } }), [
		{ address: "a", name: "John Doe" },
	])
}

async function test_query_indexed_order_by() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			user: { address: "primary", name: "string?", $indexes: ["address", "name"] },
		},
	})

	await db.set("user", { address: "a", name: "John Doe" })
	await db.set("user", { address: "b", name: null })
	await db.set("user", { address: "c", name: "Jane Doe" })

	// Ascending
	assertDeepEqual(await db.query("user", { orderBy: { address: "asc" } }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])

	// Descending
	assertDeepEqual(await db.query("user", { orderBy: { address: "desc" } }), [
		{ address: "c", name: "Jane Doe" },
		{ address: "b", name: null },
		{ address: "a", name: "John Doe" },
	])

	// Limits
	assertDeepEqual(await db.query("user", { orderBy: { address: "desc" }, limit: 1 }), [
		{ address: "c", name: "Jane Doe" },
	])
	assertDeepEqual(await db.query("user", { orderBy: { address: "asc" }, limit: 2 }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
	])
}

async function test_operations_get_fields_of_all_types() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			foo: {
				id: "primary",
				exampleStr: "string",
				exampleBool: "boolean",
				exampleInt: "integer",
				exampleFloat: "float",
				exampleJson: "json",
				exampleBytes: "bytes",
			},
		},
	})

	const id = nanoid()

	const jsonValue = { foo: "a", bar: "b", qux: null, baz: 0.3 }
	await db.set("foo", {
		id,
		exampleStr: "hello world",
		exampleBool: true,
		exampleInt: -1,
		exampleFloat: 0.1,
		exampleJson: jsonValue,
		exampleBytes: new Uint8Array([0, 255]),
	})

	const result = await db.get("foo", id)

	assertDeepEqual(result, {
		id,
		exampleStr: "hello world",
		exampleBool: true,
		exampleInt: -1,
		exampleFloat: 0.1,
		exampleJson: jsonValue,
		exampleBytes: new Uint8Array([0, 255]),
	})

	// assumes stable serialization
	assertDeepEqual(jsonValue, { foo: "a", bar: "b", qux: null, baz: 0.3 })
}

async function test_operations_update_a_value() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			user: {
				id: "primary",
				name: "string",
				isModerator: "boolean",
			},
		},
	})

	const id = nanoid()

	await db.set("user", { id, name: "John", isModerator: false })
	await db.set("user", { id, name: "John Doe", isModerator: true })
	assertDeepEqual(await db.get("user", id), { id, isModerator: true, name: "John Doe" })
}

async function test_operations_delete_a_value() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			user: {
				id: "primary",
				name: "string",
			},
		},
	})

	const id = nanoid()

	await db.set("user", { id, name: "John" })
	assertIs(await db.count("user"), 1)

	await db.delete("user", id)
	assertIs(await db.get("user", id), null)
	assertIs(await db.count("user"), 0)

	await db.delete("user", id)
	assertIs(await db.get("user", id), null)
	assertIs(await db.count("user"), 0)
}

async function test_query_select() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			user: { id: "primary", isModerator: "boolean", name: "string?" },
		},
	})

	const [a, b] = ["a", "b"]
	await db.set("user", { id: a, isModerator: true, name: "John Doe" })
	await db.set("user", { id: b, isModerator: false, name: null })

	assertDeepEqual(await db.query("user", {}), [
		{ id: a, isModerator: true, name: "John Doe" },
		{ id: b, isModerator: false, name: null },
	])

	assertDeepEqual(await db.query("user", { select: { id: true } }), [{ id: a }, { id: b }])
	assertDeepEqual(await db.query("user", { select: { id: true, name: false } }), [{ id: a }, { id: b }])
	assertDeepEqual(await db.query("user", { select: { id: true, isModerator: true, name: true } }), [
		{ id: a, isModerator: true, name: "John Doe" },
		{ id: b, isModerator: false, name: null },
	])
	assertDeepEqual(await db.query("user", { select: { id: true, name: true } }), [
		{ id: a, name: "John Doe" },
		{ id: b, name: null },
	])
}

async function test_query_where() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			user: { address: "primary", name: "string?" },
		},
	})

	await db.set("user", { address: "a", name: "John Doe" })
	await db.set("user", { address: "b", name: null })
	await db.set("user", { address: "c", name: "Jane Doe" })

	// Equality
	assertDeepEqual(await db.query("user", { where: { address: "a" } }), [{ address: "a", name: "John Doe" }])
	assertDeepEqual(await db.query("user", { where: { name: "John Doe" } }), [{ address: "a", name: "John Doe" }])
	assertDeepEqual(await db.query("user", { where: { name: null } }), [{ address: "b", name: null }])

	// Negation
	assertDeepEqual(await db.query("user", { where: { name: { neq: "John Doe" } } }), [
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])
	assertDeepEqual(await db.query("user", { where: { name: { neq: null } } }), [
		{ address: "a", name: "John Doe" },
		{ address: "c", name: "Jane Doe" },
	])
	assertDeepEqual(await db.query("user", { where: { address: { neq: "c" } } }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
	])

	// Range
	assertDeepEqual(await db.query("user", { where: { address: { gte: "a" } } }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])
	assertDeepEqual(await db.query("user", { where: { address: { gt: "a" } } }), [
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])
	assertDeepEqual(await db.query("user", { where: { address: { gt: "a", lt: "c" } } }), [{ address: "b", name: null }])
	assertDeepEqual(await db.query("user", { where: { address: { gt: "a", lte: "c" } } }), [
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])
	assertDeepEqual(await db.query("user", { where: { address: { gte: "a", lt: "c" } } }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
	])

	// Multiple filters
	assertDeepEqual(await db.query("user", { where: { name: { neq: null }, address: { gt: "a" } } }), [
		{ address: "c", name: "Jane Doe" },
	])

	assertDeepEqual(await db.query("user", { where: { address: { lte: "b" }, name: { gt: null } } }), [
		{ address: "a", name: "John Doe" },
	])
}

async function test_query_order_by() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			user: { address: "primary", name: "string?" },
		},
	})

	await db.set("user", { address: "a", name: "John Doe" })
	await db.set("user", { address: "b", name: null })
	await db.set("user", { address: "c", name: "Jane Doe" })

	// Ascending
	assertDeepEqual(await db.query("user", { orderBy: { address: "asc" } }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])

	// Descending
	assertDeepEqual(await db.query("user", { orderBy: { address: "desc" } }), [
		{ address: "c", name: "Jane Doe" },
		{ address: "b", name: null },
		{ address: "a", name: "John Doe" },
	])

	// Ascending with nulls
	assertDeepEqual(await db.query("user", { orderBy: { name: "asc" } }), [
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
		{ address: "a", name: "John Doe" },
	])

	// Descending with nulls
	assertDeepEqual(await db.query("user", { orderBy: { name: "desc" } }), [
		{ address: "a", name: "John Doe" },
		{ address: "c", name: "Jane Doe" },
		{ address: "b", name: null },
	])

	// Limits
	assertDeepEqual(await db.query("user", { orderBy: { address: "desc" }, limit: 1 }), [
		{ address: "c", name: "Jane Doe" },
	])
	assertDeepEqual(await db.query("user", { orderBy: { address: "asc" }, limit: 2 }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
	])
}

async function test_query_no_query_json_fields() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			user: { address: "primary", metadata: "json" },
		},
	})

	expectThrown(async () => {
		await db.query("user", { where: { metadata: "something" } })
	}, "json properties are not supported in where clauses")
}

async function test_relations_set_get_reference_and_relation_values() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			user: { address: "primary" },
			room: {
				id: "primary",
				creator: "@user",
				members: "@user[]",
			},
		},
	})

	await db.set("user", { address: "a" })
	await db.set("user", { address: "b" })

	assertIs(await db.count("user"), 2)

	const roomId = nanoid()
	await db.set("room", { id: roomId, creator: "a", members: ["a", "b"] })
	assertDeepEqual(await db.get("room", roomId), { id: roomId, creator: "a", members: ["a", "b"] })
}

async function test_relations_select_reference_relation_values() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			user: { address: "primary" },
			room: {
				id: "primary",
				creator: "@user",
				members: "@user[]",
			},
		},
	})

	await db.set("user", { address: "a" })
	await db.set("user", { address: "b" })
	await db.set("user", { address: "c" })
	await db.set("room", { id: "x", creator: "a", members: ["a", "b"] })
	await db.set("room", { id: "y", creator: "b", members: ["b", "c"] })
	await db.set("room", { id: "z", creator: "a", members: ["a", "c"] })

	assertDeepEqual(await db.query("room", { select: { id: true, creator: true } }), [
		{ id: "x", creator: "a" },
		{ id: "y", creator: "b" },
		{ id: "z", creator: "a" },
	])

	assertDeepEqual(await db.query("room", { select: { id: true, members: true } }), [
		{ id: "x", members: ["a", "b"] },
		{ id: "y", members: ["b", "c"] },
		{ id: "z", members: ["a", "c"] },
	])

	assertDeepEqual(await db.query("room", { select: { id: true, creator: true, members: true } }), [
		{ id: "x", creator: "a", members: ["a", "b"] },
		{ id: "y", creator: "b", members: ["b", "c"] },
		{ id: "z", creator: "a", members: ["a", "c"] },
	])
}

async function test_relations_query_reference_values() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			user: { address: "primary" },
			room: {
				id: "primary",
				creator: "@user",
				members: "@user[]",
			},
		},
	})

	await db.set("user", { address: "a" })
	await db.set("user", { address: "b" })
	await db.set("user", { address: "c" })
	await db.set("room", { id: "x", creator: "a", members: ["a", "b"] })
	await db.set("room", { id: "y", creator: "b", members: ["b", "c"] })
	await db.set("room", { id: "z", creator: "a", members: ["a", "c"] })

	assertDeepEqual(await db.query("room", { where: { creator: "a" } }), [
		{ id: "x", creator: "a", members: ["a", "b"] },
		{ id: "z", creator: "a", members: ["a", "c"] },
	])

	assertDeepEqual(await db.query("room", { where: { creator: "b" } }), [{ id: "y", creator: "b", members: ["b", "c"] }])
	assertDeepEqual(await db.query("room", { where: { creator: "c" } }), [])
	assertDeepEqual(await db.query("room", { where: { creator: { neq: "a" } } }), [
		{ id: "y", creator: "b", members: ["b", "c"] },
	])
}

async function test_relations_query_filtering_on_relation_values() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			user: { address: "primary" },
			room: {
				id: "primary",
				creator: "@user",
				members: "@user[]",
			},
		},
	})

	await db.set("user", { address: "a" })
	await db.set("user", { address: "b" })
	await db.set("user", { address: "c" })
	await db.set("room", { id: "x", creator: "a", members: ["a", "b"] })
	await db.set("room", { id: "y", creator: "b", members: ["b", "c"] })
	await db.set("room", { id: "z", creator: "a", members: ["a", "c"] })

	assertDeepEqual(await db.query("room", { where: { members: ["a"] } }), [
		{ id: "x", creator: "a", members: ["a", "b"] },
		{ id: "z", creator: "a", members: ["a", "c"] },
	])

	assertDeepEqual(await db.query("room", { where: { members: ["b"] } }), [
		{ id: "x", creator: "a", members: ["a", "b"] },
		{ id: "y", creator: "b", members: ["b", "c"] },
	])

	assertDeepEqual(await db.query("room", { where: { members: ["c"] } }), [
		{ id: "y", creator: "b", members: ["b", "c"] },
		{ id: "z", creator: "a", members: ["a", "c"] },
	])

	assertDeepEqual(await db.query("room", { where: { members: ["a", "b"] } }), [
		{ id: "x", creator: "a", members: ["a", "b"] },
	])

	assertDeepEqual(await db.query("room", { where: { members: ["b", "a"] } }), [
		{ id: "x", creator: "a", members: ["a", "b"] },
	])

	assertDeepEqual(await db.query("room", { where: { members: ["b", "c"] } }), [
		{ id: "y", creator: "b", members: ["b", "c"] },
	])

	assertDeepEqual(await db.query("room", { where: { members: ["c", "b"] } }), [
		{ id: "y", creator: "b", members: ["b", "c"] },
	])

	assertDeepEqual(await db.query("room", { where: { members: ["a", "c"] } }), [
		{ id: "z", creator: "a", members: ["a", "c"] },
	])

	assertDeepEqual(await db.query("room", { where: { members: ["c", "a"] } }), [
		{ id: "z", creator: "a", members: ["a", "c"] },
	])

	assertDeepEqual(await db.query("room", { where: { members: ["a", "b", "c"] } }), [])

	assertDeepEqual(await db.query("room", { where: { members: { neq: ["a"] } } }), [
		{ id: "y", creator: "b", members: ["b", "c"] },
	])

	assertDeepEqual(await db.query("room", { where: { members: { neq: ["b"] } } }), [
		{ id: "z", creator: "a", members: ["a", "c"] },
	])

	assertDeepEqual(await db.query("room", { where: { members: { neq: ["c"] } } }), [
		{ id: "x", creator: "a", members: ["a", "b"] },
	])

	assertDeepEqual(await db.query("room", { where: { members: { neq: ["a", "b"] } } }), [])
	assertDeepEqual(await db.query("room", { where: { members: { neq: ["b", "c"] } } }), [])
	assertDeepEqual(await db.query("room", { where: { members: { neq: ["a", "c"] } } }), [])
}

async function test_subscriptions() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			user: { address: "primary" },
			room: {
				id: "primary",
				creator: "@user",
				members: "@user[]",
			},
		},
	})

	const changes: { results: ModelValue[] }[] = []
	const { id, results } = db.subscribe("user", {}, (results) => {
		changes.push({ results })
	})

	await results
	await db.set("user", { address: "a" })
	await db.set("user", { address: "b" })

	assertIs(await db.count("user"), 2)
	assertDeepEqual(changes, [
		{ results: [] },
		{ results: [{ address: "a" }] },
		{ results: [{ address: "a" }, { address: "b" }] },
	])
	db.unsubscribe(id)
}

async function test_subscriptions_filtering() {
	const db = await OpfsModelDB.initialize({
		worker: new DBWorker(),
		path: `${nanoid()}.db`,
		models: {
			user: { address: "primary" },
			room: {
				id: "primary",
				creator: "@user",
				members: "@user[]",
			},
		},
	})

	await db.set("user", { address: "a" })
	await db.set("user", { address: "b" })
	await db.set("user", { address: "c" })

	const changes: { results: ModelValue[] }[] = []
	const { id, results } = db.subscribe("room", { where: { creator: "a" } }, (results) => {
		changes.push({ results })
	})

	await results

	await db.set("room", { id: "x", creator: "a", members: ["a", "b"] })
	await db.set("room", { id: "y", creator: "b", members: ["b", "c"] })
	await db.set("room", { id: "z", creator: "a", members: ["a", "c"] })
	await db.set("user", { address: "d" })
	await db.set("user", { address: "e" })

	assertDeepEqual(changes, [
		{ results: [] },
		{ results: [{ id: "x", creator: "a", members: ["a", "b"] }] },
		{
			results: [
				{ id: "x", creator: "a", members: ["a", "b"] },
				{ id: "z", creator: "a", members: ["a", "c"] },
			],
		},
	])
	db.unsubscribe(id)
}
