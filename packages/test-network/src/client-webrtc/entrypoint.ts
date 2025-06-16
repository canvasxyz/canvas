import { randomBytes } from "node:crypto"

import puppeteer from "puppeteer"

import { PeerId } from "@libp2p/interface"
import { peerIdFromPrivateKey } from "@libp2p/peer-id"
import { generateKeyPair, privateKeyToProtobuf } from "@libp2p/crypto/keys"
import { bytesToHex } from "@noble/hashes/utils"

import { WorkerSocket } from "@canvas-js/test-network/socket-worker"

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

/** { [name] -> Peer } */
const peers = new Map<string, Peer>()

class Peer {
	static async start(options: { interval?: number | null } = {}) {
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
		}

		if (typeof options.interval === "number") {
			query.interval = options.interval.toString()
		}

		const q = Object.entries(query)
			.map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
			.join("&")

		const url = `http://localhost:8000/client-webrtc/index.html?${q}`

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
		page.on("error", (err) => console.error(`[page-${this.name}] [error] ${err}`))
		page.on("pageerror", (err) => console.error(`[page-${this.name}] [pageerror] ${err}`))
		page.goto(url).catch((err) => {
			// possible timeout
			console.error(err)
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
				console.error(err)
			} finally {
				this.page.removeAllListeners()
			}
		}

		if (!this.context.closed) {
			try {
				await this.context.close()
			} catch (err) {
				console.error(err)
			} finally {
				this.context.removeAllListeners()
			}
		}

		console.log(`[page-${this.name}] stopped`)
	}

	private handleConsole = async (msg: puppeteer.ConsoleMessage) => {
		if (this.page.isClosed()) return
		const args = await Promise.all(
			msg.args().map(async (arg) => {
				try {
					return await arg.evaluate(this.formatValue)
				} catch (err) {
					return arg.toString()
				}
			}),
		)

		console.log(`[page-${this.name}] [${msg.type()}]`, args.join(" "))
	}

	private formatValue = (value: unknown) => {
		if (value instanceof Error) {
			return `${value.name}: ${value.message}\n${value.stack}`
		}

		return String(value)
	}
}

const worker = await WorkerSocket.open("http://localhost:8000")

worker.addEventListener("disconnect", () => {
	for (const peer of peers.values()) {
		peer.stop()
	}
})

worker.addEventListener("peer:start", ({ detail: { interval } }) => {
	Peer.start({ interval }).then(
		(peer) => console.log(`started peer ${peer.peerId}`),
		(err) => console.error(`failed to start peer`, err),
	)
})

worker.addEventListener("peer:stop", ({ detail: { id } }) => {
	const peer = peers.get(id)
	if (peer !== undefined) {
		peer.stop()
	}
})
