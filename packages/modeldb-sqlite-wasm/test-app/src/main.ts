import { nanoid } from "nanoid"
import { OpfsModelDB } from "@canvas-js/modeldb-sqlite-wasm"
import DBWorker from "./worker.js?worker"

function assert(condition: boolean, message = "Assertion failed") {
	if (!condition) {
		throw new Error(message)
	}
}

function assertDeepEqual(o1: any, o2: any) {
	assert(deepEqual(o1, o2), `${o1} is not equal to ${o2}`)
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
