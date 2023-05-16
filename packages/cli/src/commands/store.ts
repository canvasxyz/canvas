import fs from "node:fs"
import path from "node:path"
import http from "node:http"
import assert from "node:assert"
import process from "node:process"

import type { Argv } from "yargs"
import chalk from "chalk"
import stoppable from "stoppable"
import express from "express"
import cors from "cors"
import { StatusCodes } from "http-status-codes"
import { anySignal } from "any-signal"
import { peerIdFromString } from "@libp2p/peer-id"

import { multiaddr } from "@multiformats/multiaddr"

import { getPeerId, MemoryCache, Network, NetworkConfig, Store, testnetBootstrapList } from "@canvas-js/store"
import { MIN_CONNECTIONS, MAX_CONNECTIONS, PING_TIMEOUT } from "@canvas-js/store/constants"

export const command = "store <path>"
export const desc = "Replicate a store"

export const builder = (yargs: Argv) =>
	yargs
		.positional("path", {
			type: "string",
			demandOption: true,
		})
		.option("name", {
			type: "string",
			demandOption: true,
		})
		.option("port", {
			type: "number",
			desc: "Port to bind the Store API",
			default: 8000,
		})
		.option("listen", {
			type: "array",
			desc: "Internal /ws multiaddr, e.g. /ip4/0.0.0.0/tcp/4444/ws",
		})
		.option("announce", {
			type: "array",
			desc: "Public /ws multiaddr, e.g. /dns4/myapp.com/tcp/4444/ws",
		})
		.option("testnet", {
			type: "boolean",
			desc: "Bootstrap to the private testnet (requires internal VPN)",
		})
		.option("bootstrap", {
			type: "array",
			desc: "Set custom bootstrap servers",
		})
		.option("min-connections", {
			type: "number",
			desc: "Auto-dial peers while below a threshold",
			default: MIN_CONNECTIONS,
		})
		.option("max-connections", {
			type: "number",
			desc: "Stop accepting connections above a limit",
			default: MAX_CONNECTIONS,
		})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const announce: string[] = []
	for (const address of args.announce ?? []) {
		assert(typeof address === "string", "--announce address must be a string")
		const addr = multiaddr(address)
		const lastProtoName = addr.protoNames().pop()
		assert(lastProtoName === "ws" || lastProtoName === "wss", "--announce address must be a /ws or /wss multiaddr")
		announce.push(address)
	}

	const listen: string[] = []
	for (const address of args.listen ?? []) {
		assert(typeof address === "string", "--listen address must be a string")
		const addr = multiaddr(address)
		const lastProtoName = addr.protoNames().pop()
		assert(lastProtoName === "ws" || lastProtoName === "wss", "--listen address must be a /ws or /wss multiaddr")
		listen.push(address)
	}

	const networkConfig: NetworkConfig = {
		listen,
		announce,
		minConnections: args["min-connections"],
		maxConnections: args["max-connections"],
	}

	if (args.testnet) {
		networkConfig.bootstrapList = testnetBootstrapList
	} else if (args.bootstrap) {
		networkConfig.bootstrapList = []
		for (const bootstrapAddress of args.bootstrap) {
			assert(typeof bootstrapAddress === "string", "bootstrap addresses must be multiaddrs")
			networkConfig.bootstrapList.push(bootstrapAddress)
		}
	}

	if (!fs.existsSync(args.path)) {
		fs.mkdirSync(args.path)
	}

	const peerIdPath = path.resolve(args.path, "id")
	const peerId = await getPeerId({
		setPrivateKey: async (privateKey) => fs.writeFileSync(peerIdPath, privateKey),
		getPrivateKey: async () => {
			if (fs.existsSync(peerIdPath)) {
				return fs.readFileSync(peerIdPath, "utf-8")
			} else {
				return null
			}
		},
	})

	const controller = new AbortController()
	const network = await Network.open(peerId, networkConfig)
	const store = await Store.open(network.libp2p, {
		path: args.path,
		name: args.name,
		apply: async (key, value) => {
			console.log("applying...", {
				key: Buffer.from(key).toString("hex"),
				value: Buffer.from(value).toString("hex"),
			})
		},
	})

	console.log(chalk.bold(`[canvas] Using PeerId ${peerId}`))

	const app = express()
	app.use(cors())

	const hexPattern = /^([a-fA-F0-9]{2})+$/
	app.get("/", async (req, res) => {
		const { key } = req.query
		if (typeof key !== "string" || !hexPattern.test(key)) {
			return res.status(StatusCodes.BAD_REQUEST).end()
		}

		try {
			const value = await store.get(Buffer.from(key, "hex"))
			if (value === null) {
				return res.status(StatusCodes.NOT_FOUND).end()
			} else {
				return res.status(StatusCodes.OK).end(Buffer.from(value).toString("hex") + "\n")
			}
		} catch (err) {
			return res.status(StatusCodes.INTERNAL_SERVER_ERROR).end()
		}
	})

	app.post("/", async (req, res) => {
		const { key, value } = req.query
		console.log("got key, value", { key, value })
		if (typeof key !== "string" || !hexPattern.test(key)) {
			return res.status(StatusCodes.BAD_REQUEST).end()
		} else if (typeof value !== "string" || !hexPattern.test(value)) {
			return res.status(StatusCodes.BAD_REQUEST).end()
		}

		try {
			await store.insert(Buffer.from(key, "hex"), Buffer.from(value, "hex"))
			return res.status(StatusCodes.OK).end()
		} catch (err) {
			return res.status(StatusCodes.INTERNAL_SERVER_ERROR).end()
		}
	})

	app.get("/p2p/connections", (req, res) => {
		const connections = network.libp2p.getConnections()
		return res.status(StatusCodes.OK).json(
			Object.fromEntries(
				connections.map((connection) => [
					connection.id,
					{
						peer: connection.remotePeer.toString(),
						addr: connection.remoteAddr.toString(),
						streams: Object.fromEntries(connection.streams.map((stream) => [stream.id, stream.stat.protocol])),
					},
				])
			)
		)
	})

	app.get("/p2p/peers", (req, res) => {
		const peers = network.libp2p.pubsub.getPeers().map((peer) => peer.toString())
		return res.status(StatusCodes.OK).json(peers)
	})

	app.get("/p2p/subscribers", (req, res) => {
		const topics = network.libp2p.pubsub.getTopics()
		const subscribers = Object.fromEntries(
			topics.map((topic) => [topic, network.libp2p.pubsub.getSubscribers(topic).map((peer) => peer.toString())])
		)
		return res.status(StatusCodes.OK).json(subscribers)
	})

	app.post("/p2p/:peerId", async (req, res) => {
		const requestController = new AbortController()
		req.on("close", () => requestController.abort())

		const signal = anySignal([AbortSignal.timeout(PING_TIMEOUT), requestController.signal])

		try {
			const peerId = peerIdFromString(req.params.peerId)
			const latency = await network.libp2p.ping(peerId, { signal })
			res.status(StatusCodes.OK).end(`Got response from ${peerId} in ${latency}ms\n`)
		} catch (err) {
			res.status(StatusCodes.INTERNAL_SERVER_ERROR).end()
		} finally {
			signal.clear()
		}
	})

	const server = stoppable(http.createServer(app), 0)
	server.listen(args.port, () => {
		console.log(`listening on http://localhost:${args.port}`)
	})

	controller.signal.addEventListener("abort", async () => {
		server.stop()
		await store.close()
		await network.stop()
	})

	let stopping = false
	process.on("SIGINT", () => {
		if (stopping) {
			process.exit(1)
		} else {
			stopping = true
			process.stdout.write(
				`\n${chalk.yellow("Received SIGINT, attempting to exit gracefully. ^C again to force quit.")}\n`
			)

			controller.abort()
		}
	})
}
