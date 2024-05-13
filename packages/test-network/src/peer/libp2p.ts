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

import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { gossiplog } from "@canvas-js/gossiplog/service"

import { bootstrapList, listen, announce, getPeerId } from "./config.js"
import { randomBytes } from "@noble/hashes/utils"

const { MIN_CONNECTIONS, MAX_CONNECTIONS } = process.env

export const topic = "test-network-example"

let minConnections: number | undefined = undefined
let maxConnections: number | undefined = undefined

if (MIN_CONNECTIONS !== undefined) minConnections = parseInt(MIN_CONNECTIONS)
if (MAX_CONNECTIONS !== undefined) maxConnections = parseInt(MAX_CONNECTIONS)

export const getTopicDHTProtocol = (topic: string) => `/canvas/kad/${topic}/1.0.0`

export async function getLibp2p(messageLog: AbstractGossipLog) {
	const peerId = await getPeerId()

	await messageLog.write((txn) => messageLog.append(txn, randomBytes(16)))
	await messageLog.write((txn) => messageLog.append(txn, randomBytes(16)))
	await messageLog.write((txn) => messageLog.append(txn, randomBytes(16)))
	await messageLog.write((txn) => messageLog.append(txn, randomBytes(16)))
	await messageLog.write((txn) => messageLog.append(txn, randomBytes(16)))
	await messageLog.write((txn) => messageLog.append(txn, randomBytes(16)))
	await messageLog.write((txn) => messageLog.append(txn, randomBytes(16)))
	await messageLog.write((txn) => messageLog.append(txn, randomBytes(16)))
	await messageLog.write((txn) => messageLog.append(txn, randomBytes(16)))
	await messageLog.write((txn) => messageLog.append(txn, randomBytes(16)))
	await messageLog.write((txn) => messageLog.append(txn, randomBytes(16)))
	await messageLog.write((txn) => messageLog.append(txn, randomBytes(16)))

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

			dht: kadDHT({ protocol: getTopicDHTProtocol(topic) }),

			pubsub: gossipsub({
				emitSelf: false,
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

			gossiplog: gossiplog(messageLog, {}),
		},
	})
}
