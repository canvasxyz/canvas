import { nanoid } from "nanoid"
import { OpfsModelDB } from "@canvas-js/modeldb-sqlite-wasm"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
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

async function loadWorkerScriptAsURL(sourceURL: string) {
	const workerResponse = await fetch(sourceURL)
	const workerSource = await workerResponse.text()
	const blob = new Blob([workerSource], { type: "application/javascript" })
	return URL.createObjectURL(blob)
}

const startButton = document.getElementById("start")!
startButton.onclick = async () => {
	try {
		console.log("import.meta.url:")
		console.log(import.meta.url)
		// puppeteer is weird about requesting the worker js file itself
		// so we can just pass it in as a blob
		const sourceURL = `${document.location.origin}/dist/worker.js`
		const workerUrl = await loadWorkerScriptAsURL(sourceURL)

		const db = await OpfsModelDB.initialize({
			origin,
			workerUrl,
			path: "test.db",
			models: {
				foo: {
					id: "primary",
					exampleStr: "string",
					// exampleBool: "boolean",
					// exampleInt: "integer",
					// exampleFloat: "float",
					// exampleJson: "json",
					// exampleBytes: "bytes",
				},
			},
		})

		const id = nanoid()

		const jsonValue = { foo: "a", bar: "b", qux: null, baz: 0.3 }
		await db.set("foo", {
			id,
			exampleStr: "hello world",
			// exampleBool: true,
			// exampleInt: -1,
			// exampleFloat: 0.1,
			// exampleJson: jsonValue,
			// exampleBytes: new Uint8Array([0, 255]),
		})

		// const result = await db.get("foo", id)

		db.close()

		done({ done: true })
	} catch (error) {
		console.log(error)
		done({ error: error.message, stack: error.stack })
	}
}
