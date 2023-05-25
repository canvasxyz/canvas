// import { Libp2p, createLibp2p } from "libp2p"

// import { PeerId } from "@libp2p/interface-peer-id"
// import { logger } from "@libp2p/logger"
// import { anySignal } from "any-signal"

// import { StoreInit } from "@canvas-js/store/service/node"
// import { ServiceMap, getLibp2pOptions } from "./libp2p.js"

// import { PING_DELAY, PING_INTERVAL, PING_TIMEOUT } from "./constants.js"
// import { wait } from "./utils.js"

// export interface NetworkConfig {
// 	listen?: string[]
// 	announce?: string[]
// 	bootstrapList?: string[]
// 	minConnections?: number
// 	maxConnections?: number

// 	storeInit: StoreInit
// }

// export class Network {
// 	private readonly log = logger("canvas:network")
// 	private readonly controller = new AbortController()

// 	public static async open(path: string, peerId: PeerId, config: NetworkConfig): Promise<Network> {
// 		const libp2p = await createLibp2p(await getLibp2pOptions(path, peerId, config))
// 		return new Network(libp2p)
// 	}

// 	private constructor(public readonly libp2p: Libp2p<ServiceMap>) {
// 		libp2p.addEventListener("peer:connect", ({ detail: peerId }) => {
// 			this.log("opened connection peer %p", peerId)
// 		})

// 		libp2p.addEventListener("peer:disconnect", ({ detail: peerId }) => {
// 			this.log("closed connection to peer %p", peerId)
// 		})

// 		libp2p.addEventListener("peer:discovery", ({ detail: peerInfo }) => {
// 			this.log("peer:discovery %p", peerInfo.id)
// 		})

// 		this.startPingService()
// 	}

// 	public async stop(): Promise<void> {
// 		this.controller.abort()
// 		await Promise.all(this.libp2p.getConnections().map((connection) => connection.close()))
// 		await this.libp2p.stop()
// 	}

// 	private async startPingService() {
// 		const { ping: pingService } = this.libp2p.services
// 		const log = logger("canvas:network:ping")
// 		log("started ping service")

// 		const { signal } = this.controller
// 		try {
// 			await wait(PING_DELAY, { signal })
// 			while (!signal.aborted) {
// 				const peers = this.libp2p.getPeers()
// 				await Promise.all(
// 					peers.map(async (peer) => {
// 						const timeoutSignal = anySignal([AbortSignal.timeout(PING_TIMEOUT), signal])
// 						try {
// 							const latency = await pingService.ping(peer, { signal: timeoutSignal })
// 							log("peer %p responded to ping in %dms", peer, latency)
// 						} catch (err) {
// 							log("peer %p failed to respond to ping", peer)
// 							await this.libp2p.hangUp(peer)
// 						} finally {
// 							timeoutSignal.clear()
// 						}
// 					})
// 				)

// 				await wait(PING_INTERVAL, { signal })
// 			}
// 		} catch (err) {
// 			if (signal.aborted) {
// 				log("service aborted")
// 			} else {
// 				log.error("service crashed: %o", err)
// 			}
// 		}
// 	}
// }
