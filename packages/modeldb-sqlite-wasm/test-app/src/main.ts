import { nanoid } from "nanoid"
import { OpfsModelDB } from "@canvas-js/modeldb-sqlite-wasm"
import DBWorker from "./worker.js?worker"

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
	]
	const results: any = {}
	let suitePassed = true

	for (const test of tests) {
		try {
			await test()
			results[test.name] = { status: "pass" }
		} catch (error: any) {
			results[test.name] = { status: "fail", message: error.message }
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
