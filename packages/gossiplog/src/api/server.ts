import http from "node:http"

import { Logger, logger } from "@libp2p/logger"
import { CodeError, Stream, StreamMuxer, TypedEventEmitter } from "@libp2p/interface"
import { ProtocolStream, handle, select } from "@libp2p/multistream-select"

import { createServer } from "it-ws/server"
import { DuplexWebSocket } from "it-ws/duplex"
import WebSocket from "it-ws/web-socket"
import { pipe } from "it-pipe"
import * as lp from "it-length-prefixed"
import { pushable } from "it-pushable"
import { equals } from "uint8arrays"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"

import { assert } from "@canvas-js/utils"

import { Event } from "#protocols/events"

import { AbstractGossipLog, GossipLogEvents } from "../AbstractGossipLog.js"
import * as sync from "../sync/index.js"
import { decodeId, encodeId } from "../ids.js"
import { codes } from "../utils.js"

import { factory, getPushProtocol, getSyncProtocol, chunk, decodeEvents, encodeEvents } from "./utils.js"

const ipv4Pattern = /^\d+\.\d+\.\d+.\d+$/
const isIPv4 = (address: string) => ipv4Pattern.test(address)

class Connection<Payload> {
	readonly id = bytesToHex(randomBytes(8))
	readonly log = logger(`canvas:sync:api:server:${this.id}`)
	readonly muxer: StreamMuxer
	readonly eventSource = pushable<Event>({ objectMode: true })
	readonly pushProtocol = getPushProtocol(this.gossipLog.topic)
	readonly syncProtocol = getSyncProtocol(this.gossipLog.topic)
	readonly sourceURL: string

	constructor(readonly gossipLog: AbstractGossipLog<Payload>, readonly socket: DuplexWebSocket) {
		const { remoteAddress, remotePort } = socket
		this.log("new connection from %s:%d", remoteAddress, remotePort)
		gossipLog.addEventListener("message", this.handleMessage)
		gossipLog.addEventListener("sync", this.handleSync)

		if (isIPv4(remoteAddress)) {
			this.sourceURL = `ws://${remoteAddress}:${remotePort}`
		} else {
			this.sourceURL = `ws://[${remoteAddress}]:${remotePort}`
		}

		this.muxer = factory.createStreamMuxer({
			direction: "inbound",

			onIncomingStream: (stream) => {
				handle(stream, [this.pushProtocol, this.syncProtocol], {
					log: this.log,
				}).then(this.handleProtocolStream, (err) => this.log.error("failed to negotiate protocol: %O", err))
			},

			onStreamEnd: (stream) => {
				this.log("stream %s closed", stream.id)
			},
		})

		pipe(socket, this.muxer, chunk, socket)
			.then(() => this.muxer.close())
			.catch((err) => this.log.error(err))
	}

	public close() {
		this.gossipLog.removeEventListener("message", this.handleMessage)
		this.gossipLog.removeEventListener("sync", this.handleSync)
		this.muxer.close()
	}

	public isConnected(): boolean {
		return this.socket.socket.readyState === WebSocket.OPEN
	}

	private async newStream(protocol: string): Promise<Stream> {
		const muxerStream = await this.muxer.newStream()
		const { stream } = await select(muxerStream, protocol, { log: this.log }).catch((err) => {
			this.log.error("failed to open outgoing %s stream: %O", protocol, err)
			throw err
		})

		return stream
	}

	private readonly handleSync = ({ detail: { messageCount, peer } }: GossipLogEvents["sync"]) => {
		if (messageCount > 0 && peer !== undefined && peer !== this.sourceURL) {
			this.gossipLog.getClock().then(([_, heads]) => {
				this.push({ update: { heads: heads.map(encodeId) } })
			})
		}
	}

	private readonly handleMessage = ({ detail: { key, value, source } }: GossipLogEvents["message"]) => {
		if (source == undefined || source.type === "pubsub") {
			this.push({ insert: { key, value } })
		} else if (source.type === "push") {
			if (source.peer === this.sourceURL) {
				return
			} else if (source.peer.startsWith("ws://")) {
				this.push({ insert: { key, value } })
			}
		}
	}

	private readonly handleProtocolStream = async ({ protocol, stream }: ProtocolStream<Stream>) => {
		this.log("server: new stream %s with protocol %s", stream.id, protocol)

		if (protocol === this.syncProtocol) {
			this.gossipLog.serve((txn) => sync.Server.handleStream(txn, stream)).catch((err) => this.log.error(err))
		} else if (protocol === this.pushProtocol) {
			pipe(stream.source, lp.decode, decodeEvents, this.eventSink).catch((err) => this.log.error(err))
			pipe(this.eventSource, encodeEvents, lp.encode, stream.sink).catch((err) => this.log.error(err))
		} else {
			throw new Error("unsupported protocol")
		}
	}

	private readonly eventSink = async (events: AsyncIterable<Event>) => {
		for await (const event of events) {
			if (event.insert !== undefined) {
				await this.handleInsertEvent(event.insert)
			} else if (event.update !== undefined) {
				await this.handleUpdateEvent(event.update)
			} else {
				throw new Error("invalid event")
			}
		}
	}

	private push(event: Event) {
		this.eventSource.push(event)
	}

	private async handleInsertEvent({ key, value }: Event.Insert) {
		const signedMessage = this.gossipLog.decode(value, {
			source: { type: "push", peer: this.sourceURL },
		})

		assert(equals(key, signedMessage.key), "invalid key")

		try {
			await this.gossipLog.insert(signedMessage)
		} catch (err) {
			if (err instanceof CodeError && err.code === codes.MISSING_PARENT) {
				this.sync()
				return
			} else {
				throw err
			}
		}
	}

	private async handleUpdateEvent({ heads }: Event.Update) {
		this.log("handling update: %o", heads.map(decodeId))

		const result = await this.gossipLog.tree.read((txn) => {
			for (const key of heads) {
				const leaf = txn.getNode(0, key)
				if (leaf === null) {
					return key
				}
			}

			return null
		})

		if (result !== null) {
			this.sync()
		}
	}

	private async sync(): Promise<void> {
		do {
			const stream = await this.newStream(this.syncProtocol)
			this.log("opened outgoing sync stream %s", stream.id)

			const client = new sync.Client(stream)

			try {
				const result = await this.gossipLog.sync(client)
				if (result.complete) {
					break
				} else {
					continue
				}
			} finally {
				client.end()
				stream.close().then(
					() => this.log("closed outgoing sync stream %s", stream.id),
					(err) => this.log.error("error closing sync stream %s: %O", stream.id, err),
				)
			}
		} while (this.isConnected())
	}
}

export function createAPI<Payload>(gossipLog: AbstractGossipLog<Payload>, server?: http.Server) {
	const connections = new Map<string, Connection<Payload>>()
	return createServer({
		server,
		onConnection: (socket) => {
			const connection = new Connection(gossipLog, socket)

			connections.set(connection.id, connection)
			socket.socket.addEventListener("close", () => {
				connection.close()
				connections.delete(connection.id)
			})
		},
	})
}
