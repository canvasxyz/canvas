import http from "node:http"

import { logger } from "@libp2p/logger"
import { Stream, StreamMuxer } from "@libp2p/interface"
import { ProtocolStream, handle, select } from "@libp2p/multistream-select"
import { yamux } from "@chainsafe/libp2p-yamux"

import { WebSocket } from "ws"
import duplex, { DuplexWebSocket } from "it-ws/duplex"
import { pipe } from "it-pipe"
import * as lp from "it-length-prefixed"
import { pushable } from "it-pushable"
import { equals } from "uint8arrays"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"

import { assert } from "@canvas-js/utils"

import * as sync from "@canvas-js/gossiplog/sync"
import { Event } from "@canvas-js/gossiplog/protocols/events"
import { MissingParentError } from "@canvas-js/gossiplog/errors"

import { AbstractGossipLog, GossipLogEvents } from "../AbstractGossipLog.js"
import { decodeId, encodeId } from "../MessageId.js"
import { getPushProtocol, getSyncProtocol, chunk, decodeEvents, encodeEvents } from "../utils.js"

export const factory = yamux({})({ logger: { forComponent: logger } })

const ipv4Pattern = /^\d+\.\d+\.\d+.\d+$/
const isIPv4 = (address: string) => ipv4Pattern.test(address)

export class NetworkServer<Payload> {
	public readonly connections = new Map<string, Connection<Payload>>()

	constructor(readonly gossipLog: AbstractGossipLog<Payload>) {}

	public close() {
		for (const connection of this.connections.values()) {
			connection.close()
		}

		this.connections.clear()
	}

	public handleConnection = (socket: WebSocket, req: http.IncomingMessage) => {
		const connection = new Connection(this.gossipLog, socket, req)
		this.connections.set(connection.id, connection)
		this.gossipLog.dispatchEvent(new CustomEvent("connect", { detail: { peer: connection.sourceURL } }))

		socket.addEventListener("close", () => {
			connection.close()
			this.connections.delete(connection.id)
			this.gossipLog.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: connection.sourceURL } }))
		})
	}
}

class Connection<Payload> {
	readonly id = bytesToHex(randomBytes(8))
	readonly log = logger(`canvas:network:server:${this.id}`)
	readonly muxer: StreamMuxer
	readonly eventSource = pushable<Event>({ objectMode: true })
	readonly pushProtocol: string
	readonly syncProtocol: string
	readonly sourceURL: string

	constructor(readonly gossipLog: AbstractGossipLog<Payload>, readonly socket: WebSocket, req: http.IncomingMessage) {
		this.pushProtocol = getPushProtocol(gossipLog.topic)
		this.syncProtocol = getSyncProtocol(gossipLog.topic)

		const { remoteAddress, remotePort } = req.socket
		assert(remoteAddress !== undefined, "expected remoteAddress !== undefined")
		assert(remotePort !== undefined, "expected remotePort !== undefined")

		const stream: DuplexWebSocket = duplex(socket, { remoteAddress, remotePort })

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

		pipe(stream, this.muxer, chunk, stream)
			.then(() => this.muxer.close())
			.catch((err) => this.log.error(err))
	}

	public close() {
		this.gossipLog.removeEventListener("message", this.handleMessage)
		this.gossipLog.removeEventListener("sync", this.handleSync)
		this.muxer.close()
	}

	public isConnected(): boolean {
		return this.socket.readyState === WebSocket.OPEN
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

	private readonly handleMessage = ({ detail: { id, key, value, source } }: GossipLogEvents["message"]) => {
		this.log.trace("handling message %s from source %o", id, source)
		if (source === undefined || source.type === "pubsub") {
			this.log.trace("pushing message %s to %s", id, this.sourceURL)
			this.push({ insert: { key, value } })
		} else if (source.type === "push") {
			if (source.peer === this.sourceURL) {
				return
			} else if (source.peer.startsWith("ws://")) {
				this.log.trace("pushing message %s to %s", id, this.sourceURL)
				this.push({ insert: { key, value } })
			}
		}
	}

	private readonly handleProtocolStream = ({ protocol, stream }: ProtocolStream<Stream>) => {
		this.log("server: new stream %s with protocol %s", stream.id, protocol)

		if (protocol === this.syncProtocol) {
			this.gossipLog.serve((txn) => sync.Server.handleStream(txn, stream)).catch((err) => this.log.error(err))
		} else if (protocol === this.pushProtocol) {
			pipe(stream.source, lp.decode, decodeEvents, this.eventSink).catch((err) => this.log.error(err))
			pipe(this.eventSource, encodeEvents, lp.encode, stream.sink).catch((err) => this.log.error(err))

			this.gossipLog.getClock().then(([_, heads]) => this.push({ update: { heads: heads.map(encodeId) } }))
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
			if (err instanceof MissingParentError) {
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
			let stream: Stream
			try {
				stream = await this.newStream(this.syncProtocol)
			} catch (err) {
				this.log.error("failed to open outgoing sync stream: %O", err)
				return
			}

			const client = new sync.Client(stream)
			try {
				const result = await this.gossipLog.sync(client, { peer: this.sourceURL })
				if (result.complete) {
					break
				} else {
					continue
				}
			} catch (err) {
				this.log.error("sync failed: %O", err)
				return
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
