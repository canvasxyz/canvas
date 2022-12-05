import dns from "node:dns"
import http from "node:http"

import { createLibp2p } from "libp2p"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { kadDHT } from "@libp2p/kad-dht"
import { bootstrap } from "@libp2p/bootstrap"
import { createFromProtobuf } from "@libp2p/peer-id-factory"
import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { isPrivate } from "@libp2p/utils/multiaddr/is-private"

import client from "prom-client"

const { FLY_APP_NAME, PEER_ID, BOOTSTRAP_LIST, PORT, METRICS_PORT } = process.env

const bootstrapList = BOOTSTRAP_LIST.split(" ")

const peerId = await createFromProtobuf(Buffer.from(PEER_ID, "base64"))

const RELAY_HOP_TIMEOUT = 0x7fffffff

const address = await new Promise((resolve, reject) => {
	const url = `${FLY_APP_NAME}.fly.dev`
	dns.resolve(url, (err, [address]) => {
		if (err !== null || address === undefined) {
			reject(err)
		} else {
			resolve(address)
		}
	})
})

const listen = [`/ip4/0.0.0.0/tcp/${PORT}/ws`]
const announce = [`/ip4/${address}/tcp/${PORT}/ws`]
const announceFilter = (multiaddrs) => multiaddrs.filter((multiaddr) => !isLoopback(multiaddr) && !isPrivate(multiaddr))

const libp2p = await createLibp2p({
	peerId,
	addresses: { listen, announce, announceFilter },
	connectionGater: { denyDialMultiaddr: async (peerId, multiaddr) => isLoopback(multiaddr) },
	transports: [webSockets()],
	connectionEncryption: [noise()],
	streamMuxers: [mplex()],
	peerDiscovery: [bootstrap({ list: bootstrapList })],
	dht: kadDHT({ protocolPrefix: "/canvas", clientMode: false }),
	metrics: { enabled: true },
	relay: {
		enabled: true,
		hop: {
			timeout: RELAY_HOP_TIMEOUT,
			enabled: true,
			active: true,
		},
	},
})

await libp2p.start()

const gauges = {}

async function getMetrics() {
	if (libp2p.metrics === undefined) {
		return
	}

	for (const [system, components] of libp2p.metrics.getComponentMetrics().entries()) {
		for (const [component, componentMetrics] of components.entries()) {
			for (const [metricName, trackedMetric] of componentMetrics.entries()) {
				// set the relevant gauges
				const name = `${system}-${component}-${metricName}`.replace(/-/g, "_")
				const labelName = trackedMetric.label ?? metricName.replace(/-/g, "_")
				const help = trackedMetric.help ?? metricName.replace(/-/g, "_")
				const gaugeOptions = { name, help }
				const metricValue = await trackedMetric.calculate()

				if (typeof metricValue !== "number") {
					// metric group
					gaugeOptions.labelNames = [labelName]
				}

				if (!gauges[name]) {
					// create metric if it's not been seen before
					gauges[name] = new client.Gauge(gaugeOptions)
				}

				if (typeof metricValue !== "number") {
					// metric group
					for (const [key, value] of Object.entries(metricValue)) {
						gauges[name].set({ [labelName]: key }, value)
					}
				} else {
					// metric value
					gauges[name].set(metricValue)
				}
			}
		}
	}
}

const metrics = http.createServer(async (req, res) => {
	if (req.url !== "/metrics") {
		return res.writeHead(404).end()
	} else if (req.method !== "GET") {
		return res.writeHead(405).end()
	}

	try {
		await getMetrics()
		const result = await client.register.metrics()
		return res.writeHead(200, { "Content-Type": client.register.contentType }).end(result)
	} catch (err) {
		console.error(err)
		return res.writeHead(500).end(err.toString())
	}
})

metrics.listen(Number(METRICS_PORT), "::")

process.on("SIGINT", () => {
	metrics.close()
	libp2p.stop()
})
