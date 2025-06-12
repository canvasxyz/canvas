import { randomBytes } from "node:crypto"
import puppeteer from "puppeteer"
import { generateKeyPair, privateKeyToProtobuf } from "@libp2p/crypto/keys"
import { peerIdFromPrivateKey } from "@libp2p/peer-id"
import { SporadicEmitter } from "./SporadicEmitter.js"
import { bytesToHex } from "@noble/hashes/utils"

const browser = await puppeteer.launch({
	userDataDir: `data/${randomBytes(8).toString("hex")}`,
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

let nextPageId = 0
async function newPeer() {
	const i = nextPageId++

	const privateKey = await generateKeyPair("Ed25519")
	const peerId = peerIdFromPrivateKey(privateKey)

	const query: Record<string, string> = {
		privateKey: bytesToHex(privateKeyToProtobuf(privateKey)),
	}

	const q = Object.entries(query)
		.map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
		.join("&")

	const url = `http://localhost:8000/client-webrtc/index.html?${q}`

	const context = await browser.createBrowserContext()
	const page = await context.newPage()

	const formatValue = (value: unknown) => {
		if (value instanceof Error) {
			return `${value.name}: ${value.message}\n${value.stack}`
		}

		return String(value)
	}

	page.on("console", async (msg) => {
		if (page.isClosed()) return
		const args = await Promise.all(msg.args().map((arg) => arg.evaluate(formatValue).catch(() => arg.toString())))
		console.log(`[page-${i}] [${msg.type()}]`, args.join(" "))
	})

	page.on("error", (err) => console.error(`[page-${i}] [error] ${err}`))
	page.on("pageerror", (err) => console.error(`[page-${i}] [pageerror] ${err}`))
	page.goto(url)

	// min: 10s, max: 50s
	const lifetime = 10 + Math.random() * 50
	setTimeout(async () => {
		fetch("http://localhost:8000/api/events", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ type: "stop", peerId: peerId.toString(), timestamp: Date.now(), detail: {} }),
		}).then((res) => {
			if (!res.ok) {
				console.error("failed to post stop event:", res.statusText)
			}
		})

		if (page.isClosed()) return
		try {
			page.removeAllListeners()
			await page.close({ runBeforeUnload: true })
		} catch (err) {
			console.error(err)
		}

		await context.close().catch((err) => console.error(err))
	}, lifetime * 1000)
}

new SporadicEmitter(10 * 1000, true).addListener("event", () => newPeer())
