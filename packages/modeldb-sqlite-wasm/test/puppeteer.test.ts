import test from "ava"
import puppeteer from "puppeteer"
import fs from "node:fs"
import { build } from "esbuild"
import { polyfillNode } from "esbuild-plugin-polyfill-node"

test("initialize a sqlite-wasm-opfs database", async (t) => {
	const workerBundleFilename = "./test/worker.js"
	await build({
		entryPoints: ["./test/worker.ts"],
		bundle: true,
		outfile: workerBundleFilename,
		platform: "browser",
		format: "esm",
		plugins: [polyfillNode()],
	})

	const workerBundleJs = fs.readFileSync(workerBundleFilename, {
		encoding: "utf8",
	})

	// build the worker bundle
	const browserBundleFilename = "./test/browser.js"
	await build({
		entryPoints: ["./test/browser.ts"],
		bundle: true,
		outfile: browserBundleFilename,
		platform: "browser",
		format: "esm",
		plugins: [polyfillNode()],
	})

	const browserBundleJs = fs.readFileSync(browserBundleFilename, {
		encoding: "utf8",
	})

	const indexHtml = fs.readFileSync("./test/index.html", {
		encoding: "utf8",
	})

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

	page.on("workercreated", (worker) => console.log("Worker created: " + worker.url()))
	page.on("workerdestroyed", (worker) => console.log("Worker destroyed: " + worker.url()))

	page.on("console", async (e) => {
		const args = await Promise.all(e.args().map((a) => a.jsonValue()))
		console.log(...args)
	})

	await page.setRequestInterception(true)

	const origin = "http://localhost/"
	page.on("request", (request) => {
		const url = request.url()
		console.log(`request url: ${url}`)
		if (url === origin) {
			request.respond({
				status: 200,
				contentType: "text/html",
				body: indexHtml,
				headers: {
					"Cross-Origin-Opener-Policy": "same-origin",
					"Cross-Origin-Embedder-Policy": "require-corp",
				},
			})
		} else if (url === `${origin}browser.js`) {
			request.respond({
				status: 200,
				contentType: "application/javascript",
				body: browserBundleJs,
				headers: {
					"Cross-Origin-Opener-Policy": "same-origin",
					"Cross-Origin-Embedder-Policy": "require-corp",
				},
			})
		} else if (url === `${origin}worker.js`) {
			request.respond({
				status: 200,
				contentType: "application/javascript",
				body: workerBundleJs,
				headers: {
					"Cross-Origin-Opener-Policy": "same-origin",
					"Cross-Origin-Embedder-Policy": "require-corp",
				},
			})
		} else {
			request.respond({
				status: 404,
			})
		}
	})

	await page.goto("http://localhost")

	await new Promise((resolve) => setTimeout(resolve, 2000)) // TODO: find a better way to terminate if tests don't finish

	await page.locator("#start").click()

	const selector = "div"
	await page.waitForSelector(selector)

	const elementValue = await page.evaluate((sel) => {
		const element = document.querySelector(sel)
		return element ? element.innerHTML : null
	}, selector)

	if (elementValue === null) {
		throw new Error("elementValue is null")
	}
	const result = JSON.parse(elementValue)
	t.deepEqual(result, { done: true })

	await page.close()
	await browser.close()
})
