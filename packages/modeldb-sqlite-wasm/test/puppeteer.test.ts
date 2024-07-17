import test, { ExecutionContext } from "ava"
import puppeteer from "puppeteer"
import fs from "node:fs"
import { exec } from "node:child_process"

test("initialize a sqlite-wasm-opfs database", async (t) => {
	exec("esbuild ./test/lib/bundle.js --bundle --outdir=test/lib/build --platform=browser")
	const clientJs = fs.readFileSync("./test/lib/build/bundle.js", { encoding: "utf8" })

	const browser = await puppeteer.launch({
		dumpio: true,
		headless: true,
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-extensions",
			"--enable-chrome-browser-cloud-management",
		],
	})
	const page = await browser.newPage()

	// TODO: unclear what needs to happen here
	await page.setRequestInterception(true)
	page.on("request", (request) => {
		console.log("got request")
		request.respond({
			status: 200,
			contentType: "text/html",
			body: "Success",
		})
	})

	// TODO: setting the origin sometimes affects browser behavior
	console.log("setting up browser context...")
	await page.goto("https:example.com")

	let testResults = {}
	await page.exposeFunction("updateTestResults", (_testResults: typeof testResults) => (testResults = _testResults))
	await page.exposeFunction("log", (...args: any[]) => console.log(...args))

	await page.evaluate(clientJs)
	await new Promise((resolve) => setTimeout(resolve, 5000)) // TODO: find a better way to terminate if tests don't finish
	console.log("test results:", testResults) // TODO: pass test results to test runner

	await browser.close()
})
