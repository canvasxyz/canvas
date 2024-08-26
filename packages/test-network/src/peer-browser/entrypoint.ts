import { bytesToHex, randomBytes } from "@noble/hashes/utils"
import puppeteer from "puppeteer"

const { RELAY_SERVER, BOOTSTRAP_LIST, MIN_CONNECTIONS, MAX_CONNECTIONS, DELAY, PEER_COUNT } = process.env

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

if (DELAY !== undefined) {
	query.delay = DELAY
}

const q = Object.entries(query)
	.map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
	.join("&")

const url = `http://localhost:8000/peer-browser/index.html?${q}`

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

			page.goto(url)
		})
}
