import test from "ava"
import puppeteer from "puppeteer"

test("initialize a sqlite-wasm-opfs database", async (t) => {
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

	const origin = "http://localhost:5173/"
	await page.goto(origin)

	await new Promise((resolve) => setTimeout(resolve, 2000)) // TODO: find a better way to terminate if tests don't finish

	await page.locator("#start").click()

	const selector = "div#output"
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
