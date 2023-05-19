import { PeerId } from "@libp2p/interface-peer-id"
import { logger } from "@libp2p/logger"
import { IDBTree } from "@canvas-js/okra-idb"

import { StoreService, StoreInit, StoreComponents, DeadlockError } from "../service.js"

export type { StoreService, StoreInit, StoreComponents } from "../service.js"

export function storeService(tree: IDBTree, init: StoreInit): (components: StoreComponents) => StoreService {
	const log = logger("canvas:store:service:browser")
	const controller = new AbortController()
	const lockName = `/canvas/v0/store/${init.topic}/lock`

	const incomingSyncPeers = new Set<string>()
	const outgoingSyncPeers = new Set<string>()

	return (components) =>
		new StoreService(components, init, {
			read: async (targetPeerId, callback) => {
				if (targetPeerId !== null && outgoingSyncPeers.has(targetPeerId.toString())) {
					throw new DeadlockError(targetPeerId)
				}

				log("requesting shared lock %s", lockName)
				await navigator.locks.request(lockName, { mode: "shared", signal: controller.signal }, async (lock) => {
					if (lock === null) {
						log.error("failed to acquire shared lock %s", lockName)
						throw new Error(`failed to acquire shared lock ${lockName}`)
					}

					log("acquired shared lock %s", lockName)

					if (targetPeerId !== null) {
						incomingSyncPeers.add(targetPeerId.toString())
					}

					try {
						await callback(tree)
					} catch (err) {
						log.error("error in read-only transaction: %O", err)
					} finally {
						log("releasing shared lock %s", lockName)
						if (targetPeerId !== null) {
							incomingSyncPeers.delete(targetPeerId.toString())
						}
					}
				})
			},
			write: async (sourcePeerId, callback) => {
				if (sourcePeerId !== null && incomingSyncPeers.has(sourcePeerId.toString())) {
					throw new DeadlockError(sourcePeerId)
				}

				log("requesting exclusive lock for %s", lockName)
				await navigator.locks.request(lockName, { mode: "exclusive", signal: controller.signal }, async (lock) => {
					if (lock === null) {
						log.error("failed to exclusive lock %s", lockName)
					} else {
						log("acquired exclusive lock %s", lockName)

						if (sourcePeerId !== null) {
							outgoingSyncPeers.add(sourcePeerId.toString())
						}

						try {
							await callback(tree)
						} catch (err) {
							log.error("error in read-write transaction: %O", err)
						} finally {
							log("releasing exclusive lock %s", lockName)
							if (sourcePeerId !== null) {
								outgoingSyncPeers.delete(sourcePeerId.toString())
							}
						}
					}
				})
			},
			close: async () => {
				controller.abort()
			},
		})
}
