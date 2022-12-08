import dns from "node:dns/promises"
import http from "node:http"

import { createLibp2p } from "libp2p"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { kadDHT } from "@libp2p/kad-dht"
import { bootstrap } from "@libp2p/bootstrap"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"
import { createFromProtobuf } from "@libp2p/peer-id-factory"
import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { isPrivate } from "@libp2p/utils/multiaddr/is-private"
import { CID } from "multiformats"

import client from "prom-client"

const { FLY_APP_NAME, PEER_ID, BOOTSTRAP_LIST, PORT, METRICS_PORT } = process.env

const bootstrapList = BOOTSTRAP_LIST.split(" ")

const peerId = await createFromProtobuf(Buffer.from(PEER_ID, "base64"))

const RELAY_HOP_TIMEOUT = 0x7fffffff

const listen = [`/ip6/::/tcp/${PORT}/ws`]
const announce = []

try {
	const [publicAddress] = await dns.resolve4(`${FLY_APP_NAME}.fly.dev`)
	if (publicAddress !== undefined) {
		announce.push(`/ip4/${publicAddress}/tcp/${PORT}/ws`)
	}
} catch (err) {
	console.error(err)
}

try {
	const [privateAddress] = await dns.resolve6(`${FLY_APP_NAME}.internal`)
	if (privateAddress !== undefined) {
		announce.push(`/ip6/${privateAddress}/tcp/${PORT}/ws`)
	}
} catch (err) {
	console.error(err)
}

const announceFilter = (multiaddrs) => multiaddrs.filter((multiaddr) => !isLoopback(multiaddr) || !isPrivate(multiaddr))

const libp2p = await createLibp2p({
	peerId,
	addresses: { listen, announce, announceFilter },
	connectionGater: { denyDialMultiaddr: async (peerId, multiaddr) => isLoopback(multiaddr) },
	transports: [webSockets()],
	connectionEncryption: [noise()],
	streamMuxers: [mplex()],
	peerDiscovery: [bootstrap({ list: bootstrapList })],
	dht: kadDHT({ protocolPrefix: "/canvas", clientMode: false }),
	metrics: prometheusMetrics(),
	relay: {
		enabled: true,
		hop: {
			timeout: RELAY_HOP_TIMEOUT,
			enabled: true,
			active: true,
		},
	},
})

libp2p.connectionManager.addEventListener("peer:connect", ({ detail: { id, remotePeer, remoteAddr, streams } }) => {
	console.log(`connected to ${id}: ${remotePeer.toString()} on ${remoteAddr.toString()}`)
})

libp2p.connectionManager.addEventListener("peer:disconnect", ({ detail: { id } }) => {
	console.log(`disconnected ${id}`)
})

await libp2p.start()

const dhtProvidersPattern = /^\/dht\/providers\/([a-zA-Z0-9]+)$/

const metrics = http.createServer(async (req, res) => {
	if (req.method !== "GET") {
		return res.writeHead(405).end()
	}

	if (req.url === "/metrics") {
		try {
			const result = await client.register.metrics()
			return res.writeHead(200, { "Content-Type": client.register.contentType }).end(result)
		} catch (err) {
			console.error(err)
			return res.writeHead(500).end(err.toString())
		}
	} else if (req.url === "/dht/routing-table") {
		const wan = {}
		const lan = {}
		try {
			for (const { peer } of libp2p.dht.wan.routingTable.kb.toIterable()) {
				const addresses = await libp2p.peerStore.addressBook.get(peer)
				wan[peer.toString()] = addresses.map(({ multiaddr }) => multiaddr.toString())
			}

			for (const { peer } of libp2p.dht.lan.routingTable.kb.toIterable()) {
				const addresses = await libp2p.peerStore.addressBook.get(peer)
				lan[peer.toString()] = addresses.map(({ multiaddr }) => multiaddr.toString())
			}
		} catch (err) {
			return res.writeHead(500).end(err.toString())
		}

		return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ wan, lan }))
	} else if (dhtProvidersPattern.test(req.url)) {
		const [_, cid] = dhtProvidersPattern.exec(req.url)
		const providers = {}
		try {
			for await (const peerInfo of libp2p.contentRouting.findProviders(CID.parse(cid))) {
				providers[peerInfo.id.toString()] = {
					multiaddrs: peerInfo.multiaddrs.map((addr) => addr.toString()),
					protocols: peerInfo,
				}
			}
		} catch (err) {
			console.error(err)
			return res.writeHead(500).end(err.toString())
		}

		return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(providers))
	} else {
		return res.writeHead(404).end()
	}
})

metrics.listen(Number(METRICS_PORT), "::")

process.on("SIGINT", () => {
	metrics.close()
	libp2p.stop()
})
