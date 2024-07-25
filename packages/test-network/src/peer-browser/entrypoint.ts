import { bytesToHex, randomBytes } from "@noble/hashes/utils"
import puppeteer from "puppeteer"

const { RELAY_SERVER, BOOTSTRAP_LIST, MIN_CONNECTIONS, MAX_CONNECTIONS } = process.env

const query: Record<string, string> = {}

if (RELAY_SERVER !== undefined) {
	query.relayServer = RELAY_SERVER
}

if (BOOTSTRAP_LIST !== undefined) {
	query.bootstrapList = BOOTSTRAP_LIST.split(" ").join(",")
}

if (MIN_CONNECTIONS !== undefined) {
	query.minConnections = MIN_CONNECTIONS
}

if (MAX_CONNECTIONS !== undefined) {
	query.maxConnections = MAX_CONNECTIONS
}

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

const q = Object.entries(query)
	.map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
	.join("&")

await page.goto(`http://localhost:8000/peer-browser/index.html?${q}`)

process.addListener("SIGINT", async () => {
	process.stdout.write("\nReceived SIGINT\n")
	browser.close()
})
