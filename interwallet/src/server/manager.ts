import path from "node:path"

import type { Libp2p } from "@libp2p/interface-libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import { logger } from "@libp2p/logger"
import { bytesToHex } from "@noble/hashes/utils"
import delay from "delay"

import { Store } from "@canvas-js/store"
import { openStore } from "@canvas-js/store/node"

import {
	PublicUserRegistration,
	ROOM_REGISTRY_TOPIC,
	Room,
	USER_REGISTRY_TOPIC,
	assert,
	validateEvent,
	validateRoomRegistration,
	validateUserRegistration,
} from "#utils"

import { ServiceMap, getLibp2p } from "./libp2p.js"
import { applyRoomRegistration, applyUserRegistration, getRooms } from "./db.js"
import { dataDirectory } from "./config.js"
import { PING_DELAY, PING_INTERVAL, PING_TIMEOUT } from "./constants.js"
import { anySignal } from "any-signal"

export class RoomManager {
	public static async initialize(peerId: PeerId): Promise<RoomManager> {
		const libp2p = await getLibp2p(peerId)

		const manager = new RoomManager(libp2p)

		manager.roomRegistry = await openStore(libp2p, {
			path: path.resolve(dataDirectory, "rooms"),
			topic: ROOM_REGISTRY_TOPIC,
			apply: manager.applyRoomRegistryEntry,
		})

		manager.userRegistry = await openStore(libp2p, {
			path: path.resolve(dataDirectory, "users"),
			topic: USER_REGISTRY_TOPIC,
			apply: manager.applyUserRegistryEntry,
		})

		await manager.start()

		return manager
	}

	private readonly rooms = new Map<string, { store: Store; members: PublicUserRegistration[] }>()
	private userRegistry: Store | null = null
	private roomRegistry: Store | null = null
	private controller: AbortController | null = null
	#started = false

	private readonly log = logger("canvas:interwallet:manager")

	private constructor(public readonly libp2p: Libp2p<ServiceMap>) {}

	public isStarted() {
		return this.#started
	}

	public async start() {
		if (this.userRegistry === null || this.roomRegistry === null) {
			throw new Error("tried to start uninitialized manager")
		} else if (this.#started) {
			return
		}

		this.log("starting manager")

		await this.libp2p.start()
		await this.roomRegistry.start()
		await this.userRegistry.start()

		const rooms = getRooms()
		await Promise.all(rooms.map((room) => this.addRoom(room)))

		this.controller = new AbortController()
		this.#started = true

		this.startPingService()
	}

	public async stop() {
		this.controller?.abort()
		this.controller = null

		await this.userRegistry?.stop()
		await this.roomRegistry?.stop()
		await Promise.all([...this.rooms.values()].map(({ store }) => store.stop()))

		await this.libp2p.stop()
		this.#started = false
	}

	private applyEventEntry = (room: Room) => async (key: Uint8Array, value: Uint8Array) => {
		const {} = validateEvent(room, key, value)
		this.log("storing event %s in room %s", bytesToHex(key), room.id)
		// ...
	}

	private applyRoomRegistryEntry = async (key: Uint8Array, value: Uint8Array) => {
		const room = await validateRoomRegistration(key, value)

		this.log(
			"registering room %s with members %o",
			room.id,
			room.members.map((member) => member.address)
		)

		applyRoomRegistration(room)

		await this.addRoom(room)
	}

	private applyUserRegistryEntry = async (key: Uint8Array, value: Uint8Array) => {
		const userRegistration = await validateUserRegistration(key, value)

		this.log("registering user %s", userRegistration.address)

		applyUserRegistration(userRegistration)
	}

	private async addRoom(room: Room) {
		const store = await openStore(this.libp2p, {
			path: path.resolve(dataDirectory, `room-${room.id}`),
			topic: `interwallet:room:${room.id}`,
			apply: this.applyEventEntry(room),
		})

		if (this.#started) {
			await store.start()
		}

		this.rooms.set(room.id, { store, members: room.members })
	}

	// private async removeRoom(roomId: string): Promise<void> {
	// 	const room = this.rooms.get(roomId)
	// 	if (room === undefined) {
	// 		return
	// 	}

	// 	this.rooms.delete(roomId)
	// 	await room.store.stop()
	// }

	private async startPingService() {
		const { ping: pingService } = this.libp2p.services
		const log = logger("canvas:interwallet:manager:ping")

		assert(this.controller !== null)
		log("started ping service")

		const { signal } = this.controller
		try {
			await delay(PING_DELAY, { signal })
			while (!signal.aborted) {
				const peers = this.libp2p.getPeers()
				await Promise.all(
					peers.map(async (peer) => {
						const timeoutSignal = anySignal([AbortSignal.timeout(PING_TIMEOUT), signal])
						try {
							const latency = await pingService.ping(peer, { signal: timeoutSignal })
							log("peer %p responded to ping in %dms", peer, latency)
						} catch (err) {
							log("peer %p failed to respond to ping", peer)
							await this.libp2p.hangUp(peer)
						} finally {
							timeoutSignal.clear()
						}
					})
				)

				await delay(PING_INTERVAL, { signal })
			}
		} catch (err) {
			if (signal.aborted) {
				log("service aborted")
			} else {
				log.error("service crashed: %o", err)
			}
		}
	}
}
