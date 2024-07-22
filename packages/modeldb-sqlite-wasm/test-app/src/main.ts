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
	try {
		const db = await OpfsModelDB.initialize({
			worker: new DBWorker(),
			path: "test.db",
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
		console.log(result)

		db.close()

		done({ done: true })
	} catch (error: any) {
		console.log(error)
		done({ error: error.message, stack: error.stack })
	}
}
