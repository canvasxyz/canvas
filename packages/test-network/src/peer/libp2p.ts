import { sha256 } from "@noble/hashes/sha256"

import { createLibp2p } from "libp2p"
import { identify as identifyService } from "@libp2p/identify"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from "@libp2p/kad-dht"
import { fetch } from "@libp2p/fetch"

import { Multiaddr } from "@multiformats/multiaddr"

// import { GossipLog } from "@canvas-js/gossiplog/memory"
import { GossipLog } from "@canvas-js/gossiplog/node"
import { GossipLogService, gossiplog } from "@canvas-js/gossiplog/service"

import { bootstrapList, listen, announce, getPeerId } from "./config.js"
import { randomBytes } from "@noble/hashes/utils"

const { MIN_CONNECTIONS, MAX_CONNECTIONS, SERVICE_NAME } = process.env
const serviceNameHash = sha256(SERVICE_NAME ?? new Uint8Array([]))

// export const topic = SERVICE_NAME !== "bootstrap" && serviceNameHash[0] < 128 ? "test-network-example" : null
export const topic = "test-network-example"

let minConnections: number | undefined = undefined
let maxConnections: number | undefined = undefined

if (MIN_CONNECTIONS !== undefined) minConnections = parseInt(MIN_CONNECTIONS)
if (MAX_CONNECTIONS !== undefined) maxConnections = parseInt(MAX_CONNECTIONS)

export const getTopicDHTProtocol = (topic: string) => `/canvas/kad/${topic}/1.0.0`

export async function getLibp2p() {
	const peerId = await getPeerId()

	// const log = await GossipLog.open({ topic, apply: () => {} })
	const log = await GossipLog.open({ topic, apply: () => {} }, "data")

	await log.write((txn) => log.append(txn, randomBytes(16)))
	await log.write((txn) => log.append(txn, randomBytes(16)))
	await log.write((txn) => log.append(txn, randomBytes(16)))
	await log.write((txn) => log.append(txn, randomBytes(16)))
	await log.write((txn) => log.append(txn, randomBytes(16)))
	await log.write((txn) => log.append(txn, randomBytes(16)))
	await log.write((txn) => log.append(txn, randomBytes(16)))
	await log.write((txn) => log.append(txn, randomBytes(16)))
	await log.write((txn) => log.append(txn, randomBytes(16)))
	await log.write((txn) => log.append(txn, randomBytes(16)))
	await log.write((txn) => log.append(txn, randomBytes(16)))
	await log.write((txn) => log.append(txn, randomBytes(16)))

	return await createLibp2p({
		peerId: peerId,
		start: false,
		addresses: { listen, announce },
		transports: [webSockets({ filter: all })],
		connectionGater: {
			denyDialMultiaddr: (addr: Multiaddr) => false,
		},

		connectionManager: { minConnections, maxConnections },

		peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList })] : [],

		streamMuxers: [mplex()],
		connectionEncryption: [noise()],
		services: {
			identify: identifyService({ protocolPrefix: "canvas" }),
			globalDHT: kadDHT({
				kBucketSize: 2,
				protocol: "/canvas/kad/1.0.0",
			}),

			// ...(topic === null ? {} : { topicDHT: kadDHT({ protocol: getTopicDHTProtocol(topic) }) }),

			pubsub: gossipsub({
				fallbackToFloodsub: false,
				allowPublishToZeroTopicPeers: true,
				globalSignaturePolicy: "StrictSign",

				asyncValidation: true,

				metricsTopicStrToLabel: new Map<string, string>(topic ? [[topic, topic]] : []),
				metricsRegister: {
					gauge({}) {
						return {
							inc: () => {},
							set: () => {},
							addCollect: () => {},
						}
					},
					histogram({}) {
						return {
							startTimer: () => () => {},
							observe: () => {},
							reset: () => {},
						}
					},
					avgMinMax({}) {
						return {
							set: () => {},
						}
					},
				},
			}),

			fetch: fetch({ protocolPrefix: "canvas" }),
			gossiplog: gossiplog(log, {}),
		},
	})
}
