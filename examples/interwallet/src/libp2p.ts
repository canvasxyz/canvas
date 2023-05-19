import { Libp2p, createLibp2p } from "libp2p"
import { circuitRelayTransport } from "libp2p/circuit-relay"
import { identifyService } from "libp2p/identify"
import { pingService, PingService } from "libp2p/ping"

import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub, GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import { PubSub } from "@libp2p/interface-pubsub"

import { PeerId } from "@libp2p/interface-peer-id"
import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { base64 } from "multiformats/bases/base64"

import { bytesToHex } from "viem"

import { openDB } from "idb"
import { IDBTree } from "@canvas-js/okra-idb"
import { PubsubServiceDiscovery, pubsubServiceDiscovery } from "@canvas-js/pubsub-service-discovery"

import { testnetBootstrapList } from "@canvas-js/store/bootstrap"
import { storeService, StoreService, StoreComponents } from "@canvas-js/store/service/browser"

import {
	MAX_CONNECTIONS,
	MIN_CONNECTIONS,
	PING_TIMEOUT,
	ROOM_REGISTRY_TOPIC,
	USER_REGISTRY_TOPIC,
	PEER_ID_KEY,
} from "./constants"
import { rooms } from "./fixtures"

export type ServiceMap = {
	identify: {}
	pubsub: PubSub<GossipsubEvents>
	ping: PingService

	[ROOM_REGISTRY_TOPIC]: StoreService
	[USER_REGISTRY_TOPIC]: StoreService
} & Record<`interwallet:room:${string}`, StoreService>

const db = await openDB("interwallet", 1, {
	upgrade(database, oldVersion, newVersion, transaction, event) {
		console.log(`upgrading IndexedDB database from ${oldVersion} to ${newVersion}`)

		for (const topic of [USER_REGISTRY_TOPIC, ROOM_REGISTRY_TOPIC, ...rooms.map(({ topic }) => topic)]) {
			if (database.objectStoreNames.contains(topic)) {
				continue
			} else {
				database.createObjectStore(topic)
				console.log(`created object store ${topic}`)
			}
		}
	},
})

async function getLibp2p(): Promise<Libp2p<ServiceMap>> {
	const peerId = await getPeerId()

	const userRegistryTree = await IDBTree.open(db, USER_REGISTRY_TOPIC)
	const roomRegistryTree = await IDBTree.open(db, ROOM_REGISTRY_TOPIC)

	const roomStoreServices: Record<string, (components: StoreComponents) => StoreService> = {}
	for (const { topic } of rooms) {
		const tree = await IDBTree.open(db, topic)
		roomStoreServices[topic] = storeService(tree, {
			topic,
			apply: async (key, value) => {
				console.log({ key: bytesToHex(key), value: bytesToHex(value) })
			},
		})
	}

	const bootstrapList = testnetBootstrapList

	return await createLibp2p({
		peerId: peerId,
		addresses: { listen: [], announce: [] },
		transports: [webSockets(), circuitRelayTransport({ discoverRelays: bootstrapList.length })],
		connectionEncryption: [noise()],
		streamMuxers: [mplex()],
		peerDiscovery: [bootstrap({ list: bootstrapList })],

		connectionManager: {
			minConnections: MIN_CONNECTIONS,
			maxConnections: MAX_CONNECTIONS,
		},

		services: {
			pubsub: gossipsub({
				emitSelf: false,
				fallbackToFloodsub: false,
				allowPublishToZeroPeers: true,
				globalSignaturePolicy: "StrictSign",
			}),

			identify: identifyService({
				protocolPrefix: "canvas",
			}),

			ping: pingService({
				protocolPrefix: "canvas",
				maxInboundStreams: 32,
				maxOutboundStreams: 32,
				timeout: PING_TIMEOUT,
			}),

			serviceDiscovery: pubsubServiceDiscovery({
				filterProtocols: (protocol) =>
					protocol === PubsubServiceDiscovery.DISCOVERY_TOPIC || protocol.startsWith("/canvas/v0/store/"),
			}),

			[USER_REGISTRY_TOPIC]: storeService(userRegistryTree, {
				topic: USER_REGISTRY_TOPIC,
				apply: async (key, value) => {
					console.log(`${USER_REGISTRY_TOPIC}: got entry`, { key: bytesToHex(key), value: bytesToHex(value) })
				},
			}),

			[ROOM_REGISTRY_TOPIC]: storeService(roomRegistryTree, {
				topic: ROOM_REGISTRY_TOPIC,
				apply: async (key, value) => {
					console.log(`${ROOM_REGISTRY_TOPIC}: got entry`, { key: bytesToHex(key), value: bytesToHex(value) })
				},
			}),

			...roomStoreServices,
		},
	})
}

async function getPeerId(): Promise<PeerId> {
	const entry = window.localStorage.getItem(PEER_ID_KEY)
	if (entry === null) {
		const peerId = await createEd25519PeerId()
		const privateKey = exportToProtobuf(peerId)
		window.localStorage.setItem(PEER_ID_KEY, base64.baseEncode(privateKey))
		console.log("created new peerId", peerId.toString())
		return peerId
	} else {
		const privateKey = base64.baseDecode(entry)
		const peerId = await createFromProtobuf(privateKey)
		console.log("found existing peerId", peerId.toString())
		return peerId
	}
}

export const libp2p = await getLibp2p()
