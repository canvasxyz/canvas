import { createServer } from "node:http"
import { randomBytes } from "node:crypto"
import puppeteer from "puppeteer"
import express from "express"

import { PeerId } from "@libp2p/interface"
import { peerIdFromPrivateKey } from "@libp2p/peer-id"
import { generateKeyPair, privateKeyToProtobuf } from "@libp2p/crypto/keys"
import { bytesToHex } from "@noble/hashes/utils"

import { WorkerSocket } from "@canvas-js/test-network/socket-worker"
import assert from "node:assert"

const { DASHBOARD_URL, BOOTSTRAP_SERVER, RELAY_SERVER, PORT = "3000" } = process.env

const app = express()
app.use(express.static("dist"))
app.listen(parseInt(PORT), () => console.log(`static server listening on http://localhost:${PORT}`))

const dashboardURL = DASHBOARD_URL ?? "http://localhost:8000"
const bootstrapServer =
	BOOTSTRAP_SERVER ?? "/dns4/localhost/tcp/8080/ws/p2p/12D3KooWMvSCSeJ6zxJJRQZSpyGqbNcqSJfcJGZLRiMVMePXzMax"
const relayServer =
	RELAY_SERVER ?? "/dns4/localhost/tcp/8081/ws/p2p/12D3KooWPZ12MFRfJv2S13g7aRPYYQ3pSZ7ZsJCj9whnhF3j8WNr"

const multiaddrPattern = /^\/dns(?:4|6)\/([a-zA-Z0-9.-]+)\/tcp\/(\d+)\/wss?/
assert(multiaddrPattern.test(bootstrapServer))
assert(multiaddrPattern.test(relayServer))
const [{}, bootstrapHostname, bootstrapPort] = multiaddrPattern.exec(bootstrapServer)!
const [{}, relayHostname, relayPort] = multiaddrPattern.exec(relayServer)!
const bootstrapURL = `http://${bootstrapHostname}:${bootstrapPort}`
const relayURL = `http://${relayHostname}:${relayPort}`

const browser = await puppeteer.launch({
	userDataDir: `data/${randomBytes(8).toString("hex")}`,
	headless: true,
	args: [
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--disable-web-security",
		"--allow-running-insecure-content",
		"--disable-dev-shm-usage",
		"--disable-gpu",
		"--disable-extensions",
		"--disable-background-timer-throttling",
		"--disable-features=IsolateOrigins,site-per-process",
		"--enable-features=WebCryptoAPI",
		`--unsafely-treat-insecure-origin-as-secure=http://localhost:${PORT},${dashboardURL},${bootstrapURL},${relayURL}`,
	],
})

console.log("started browser process")

process.addListener("SIGINT", async () => {
	process.stdout.write("\nReceived SIGINT\n")
	browser.close()
})

/** { [name] -> Peer } */
const peers = new Map<string, Peer>()

class Peer {
	static async start(options: { publishInterval?: number | null } = {}) {
		const privateKey = await generateKeyPair("Ed25519")
		const context = await browser.createBrowserContext()

		let page: puppeteer.Page
		try {
			page = await context.newPage()
		} catch (err) {
			await context.close()
			throw err
		}

		const peerId = peerIdFromPrivateKey(privateKey)

		const query: Record<string, string> = {
			workerId: worker.workerId,
			privateKey: bytesToHex(privateKeyToProtobuf(privateKey)),
			dashboardURL,
			bootstrapServer,
			relayServer,
		}

		if (typeof options.publishInterval === "number") {
			query.interval = options.publishInterval.toString()
		}

		const q = Object.entries(query)
			.map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
			.join("&")

		const url = `http://localhost:${PORT}?${q}`

		return new Peer(peerId, context, page, url)
	}

	readonly name: string

	private constructor(
		readonly peerId: PeerId,
		readonly context: puppeteer.BrowserContext,
		readonly page: puppeteer.Page,
		url: string,
	) {
		this.name = peerId.toString().slice(-6)
		page.on("console", this.handleConsole)
		page.on("error", (err) => console.error(`[page-${this.name}] [error] ${err.name} ${err.message} ${err.stack}`))
		page.on("pageerror", (err) =>
			console.error(`[page-${this.name}] [pageerror] ${err.name} ${err.message} ${err.stack}`),
		)

		page.goto(url).catch((err) => {
			// possible timeout
			console.error(`[page-${this.name}] [puppeteer] ${err.name} ${err.message} ${err.stack}`)
			this.stop()
		})

		peers.set(peerId.toString(), this)
	}

	public async stop() {
		console.log(`[page-${this.name}] stopping...`)
		peers.delete(this.name)

		worker.post("peer:stop", { id: this.peerId.toString() })

		if (!this.page.isClosed()) {
			try {
				await this.page.close({ runBeforeUnload: true })
			} catch (err) {
				console.error(`[page-${this.name}] [puppeteer] ${err}`)
			} finally {
				this.page.removeAllListeners()
			}
		}

		if (!this.context.closed) {
			try {
				await this.context.close()
			} catch (err) {
				console.error(`[page-${this.name}] [puppeteer] ${err}`)
			} finally {
				this.context.removeAllListeners()
			}
		}

		console.log(`[page-${this.name}] stopped`)
	}

	private handleConsole = async (msg: puppeteer.ConsoleMessage) => {
		if (this.page.isClosed()) return

		// Get the raw text first
		const text = msg.text()

		// Try to get detailed args, but fall back to text
		let formattedArgs: string[] = [text]

		try {
			const args = await Promise.all(
				msg.args().map(async (arg) => {
					try {
						const result = await arg.evaluate(this.formatValue)
						return result || "<empty>"
					} catch (err) {
						// Try getting JSON value
						try {
							const json = await arg.jsonValue()
							return JSON.stringify(json)
						} catch {
							return arg.toString()
						}
					}
				}),
			)

			if (args.length > 0 && args.some((arg) => arg !== "<empty>")) {
				formattedArgs = args
			}
		} catch (err) {
			// Fall back to raw text
		}

		console.log(`[page-${this.name}] [${msg.type()}]`, ...formattedArgs)
	}

	private formatValue = (value: unknown) => {
		if (value instanceof Error) {
			return `${value.name}: ${value.message}\n${value.stack}`
		}

		return String(value)
	}
}

const worker = await WorkerSocket.open(dashboardURL)

console.log("connected to", dashboardURL)

worker.addEventListener("disconnect", () => {
	for (const peer of peers.values()) {
		peer.stop()
	}
})

worker.addEventListener("peer:start", ({ detail: { publishInterval, lifetime } }) => {
	Peer.start({ publishInterval }).then(
		(peer) => {
			console.log(`started peer ${peer.peerId}`)
			if (typeof lifetime === "number") {
				setTimeout(() => peer.stop(), 1000 * lifetime)
			}
		},
		(err) => console.error(`failed to start peer`, err),
	)
})

worker.addEventListener("peer:stop", ({ detail: { id } }) => {
	const peer = peers.get(id)
	if (peer !== undefined) {
		peer.stop()
	}
})
