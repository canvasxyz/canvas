import { nanoid } from "nanoid"
import { OpfsModelDB } from "@canvas-js/modeldb-sqlite-wasm"
import DBWorker from "./worker.js?worker"

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
	]
	try {
		for (const test of tests) {
			await test()
		}

		done({ done: true })
	} catch (error: any) {
		console.log(error)
		done({ error: error.message, stack: error.stack })
	}
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
	let exceptionThrown = false

	let db = null
	try {
		db = await OpfsModelDB.initialize({
			worker: new DBWorker(),
			path: `${nanoid()}.db`,
			models: {
				room: {
					// @ts-ignore
					name: "unsupported",
				},
			},
		})
	} catch (e: any) {
		exceptionThrown = true
		if (e.message !== `error defining room: invalid property "unsupported"`) {
			throw new Error(
				`Expected error message to be "error defining room: invalid property 'unsupported'", but got "${e.message}"`,
			)
		}
	} finally {
		if (db) db.close()
	}

	if (!exceptionThrown) {
		throw new Error("Expected an exception to be thrown, but none was thrown")
	}
}
