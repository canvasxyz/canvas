import { bytesToHex, randomBytes } from "@noble/hashes/utils"
import puppeteer from "puppeteer"

const browser = await puppeteer.launch({
	userDataDir: `data/${bytesToHex(randomBytes(8))}`,
	headless: true,
	args: [
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--disable-web-security",
		"--disable-features=IsolateOrigins,site-per-process",
	],
})

const page = await browser.newPage()

page.on("console", (msg) => {
	console.log(`[${msg.type()}] ${msg.text()}`)
})

await page.goto("http://localhost:3000")

process.addListener("SIGINT", async () => {
	process.stdout.write("\nReceived SIGINT\n")
	browser.close()
})
