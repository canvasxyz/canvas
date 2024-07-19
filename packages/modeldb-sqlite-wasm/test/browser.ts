import { OpfsModelDB } from "@canvas-js/modeldb-sqlite-wasm"

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
		// puppeteer is weird about requesting the worker js file itself
		// so we can just pass it in as a blob
		const sourceURL = `${document.location.origin}/dist/worker.js`
		const workerUrl = await loadWorkerScriptAsURL(sourceURL)

		const db = await OpfsModelDB.initialize({ workerUrl, path: "test.db", models: {} })

		// the test itself goes here

		db.close()

		done({ done: true })
	} catch (error) {
		done({ error: error.message })
	}
}
