import { nanoid } from "nanoid"
import { OpfsModelDB } from "@canvas-js/modeldb-sqlite-wasm"
import DBWorker from "./worker.js?worker"

function assert(condition: boolean, message: string) {
	if (!condition) {
		throw new Error(message)
	}
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

	const x = await db.get("user", userA.id)
	assert(x !== null && x.id === userA.id, `expected userA, got ${x}`)
	const count1 = await db.count("user")
	assert(count1 == 1, `expected 1 user, got ${count1}`)

	await db.set("user", userB)
	const y = await db.get("user", userB.id)
	assert(y !== null && y.id === userB.id, `expected userB, got ${y}`)
	const count2 = await db.count("user")
	assert(count2 == 2, `expected 2 users, got ${count2}`)

	const room = {
		id: nanoid(),
		creator: userA.id,
		members: [userA.id, userB.id],
	}

	await db.set("room", room)
	const z = await db.get("room", room.id)
	assert(z !== null && z.id === room.id, `expected room, got ${z}`)
	const roomCount = await db.count("room")
	assert(roomCount === 1, `expected 1 room, got ${roomCount}`)

	db.close()
}
