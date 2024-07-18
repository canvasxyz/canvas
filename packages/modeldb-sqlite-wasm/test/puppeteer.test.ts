import test from "ava"
import puppeteer from "puppeteer"
import fs from "node:fs"
import { build } from "esbuild"
import { polyfillNode } from "esbuild-plugin-polyfill-node"

test("initialize a sqlite-wasm-opfs database", async (t) => {
	// build the worker bundle
	const browserBundleFilename = "./test/lib/build/browser.js"
	await build({
		entryPoints: ["./test/browser.ts"],
		bundle: true,
		outfile: browserBundleFilename,
		platform: "browser",
		plugins: [polyfillNode()],
	})

	const browserBundleJs = fs.readFileSync(browserBundleFilename, { encoding: "utf8" })

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

	await new Promise((resolve) => setTimeout(resolve, 2000)) // TODO: find a better way to terminate if tests don't finish

	const testResults: any = await new Promise((resolve) => {
		async function doThing() {
			await page.exposeFunction("updateTestResults", resolve)
			await page.exposeFunction("log", (...args: any[]) => console.log(...args))
			await page.evaluate(browserBundleJs)
		}
		doThing()
	})

	console.log(testResults)
	t.true(testResults.done)
	await browser.close()
})
