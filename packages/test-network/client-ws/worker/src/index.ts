import { randomBytes } from "node:crypto"
import puppeteer from "puppeteer"

const { DELAY, PEER_COUNT } = process.env

const query: Record<string, string> = {}

if (DELAY !== undefined) {
	query.delay = DELAY
}

const q = Object.entries(query)
	.map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
	.join("&")

const url = `http://localhost:8000/client-ws/index.html?${q}`

const browser = await puppeteer.launch({
	userDataDir: `data/${randomBytes(8).toString("hex")}`,
	headless: true,
	args: [
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--disable-web-security",
		"--disable-dev-shm-usage",
		"--disable-gpu",
		"--disable-extensions",
		"--disable-background-timer-throttling",
		"--disable-features=IsolateOrigins,site-per-process",
	],
})

process.addListener("SIGINT", async () => {
	process.stdout.write("\nReceived SIGINT\n")
	browser.close()
})

const peerCount = parseInt(PEER_COUNT ?? "1")
for (let i = 0; i < peerCount; i++) {
	browser
		.createBrowserContext()
		.then((context) => context.newPage())
		.then((page) => {
			page.on("console", (msg) => {
				console.log(`[page-${i}] [${msg.type()}] ${msg.text()}`)
			})

			page.on("error", (err) => console.error(`[page-${i}] [error] ${err.name} ${err.message} ${err.stack}`))
			page.on("pageerror", (err) => console.error(`[page-${i}] [pageerror] ${err.name} ${err.message} ${err.stack}`))
			page.goto(url)
		})
}
