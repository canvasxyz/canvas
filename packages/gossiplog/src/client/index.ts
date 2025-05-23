import { Stream } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import { yamux } from "@chainsafe/libp2p-yamux"
import { ProtocolStream, select, handle } from "@libp2p/multistream-select"

import { connect } from "it-ws/client"
import { pipe } from "it-pipe"
import { pushable } from "it-pushable"
import * as lp from "it-length-prefixed"
import { equals } from "uint8arrays"

import { assert } from "@canvas-js/utils"

import { Event } from "@canvas-js/gossiplog/protocols/events"
import * as sync from "@canvas-js/gossiplog/sync"
import { MissingParentError } from "@canvas-js/gossiplog/errors"

import { AbstractGossipLog, GossipLogEvents } from "../AbstractGossipLog.js"
import { decodeId, encodeId } from "../MessageId.js"
import { getPushProtocol, getSyncProtocol, chunk, encodeEvents, decodeEvents } from "../utils.js"

export const factory = yamux({})({ logger: { forComponent: logger } })

export class NetworkClient<Payload> {
	readonly log = logger("canvas:network:client")
	readonly pushProtocol: string
	readonly syncProtocol: string
	readonly muxer: ReturnType<typeof factory.createStreamMuxer>
	readonly duplex: ReturnType<typeof connect>
	readonly sourceURL: string
	readonly eventSource = pushable<Event>({ objectMode: true })

	error?: Error | unknown

	constructor(
		readonly gossipLog: AbstractGossipLog<Payload>,
		readonly addr: string,
	) {
		this.pushProtocol = getPushProtocol(gossipLog.topic)
		this.syncProtocol = getSyncProtocol(gossipLog.topic)
		this.sourceURL = addr
		this.duplex = connect(addr, {
			// websocket: [this.gossipLog.topic],
		})
		this.muxer = factory.createStreamMuxer({
			direction: "outbound",
			onIncomingStream: (stream) => {
				handle(stream, [this.pushProtocol, this.syncProtocol], {
					log: this.log,
				}).then(this.handleProtocolStream)
			},
			onStreamEnd: (stream) => this.log("stream %s closed (%s)", stream.id, stream.protocol),
		})

		this.gossipLog.addEventListener("message", this.handleMessage)

		pipe(this.duplex, this.muxer, chunk, this.duplex).catch((err) => this.log.error(err))

		const ws = this.duplex.socket

		ws.addEventListener("open", () => {
			gossipLog.dispatchEvent(new CustomEvent("connect", { detail: { peer: this.sourceURL } }))
		})

		ws.addEventListener("close", () => {
			gossipLog.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: this.sourceURL } }))
		})

		this.duplex
			.connected()
			.then(async () => {
				const eventStream = await this.newStream(this.pushProtocol)

				pipe(this.eventSource, encodeEvents, lp.encode, eventStream.sink).catch((err) => {
					this.log.error(err)
					eventStream.close()
				})

				pipe(eventStream.source, lp.decode, decodeEvents, this.eventSink).catch((err) => {
					this.log.error(err)
					eventStream.close()
				})

				const [_, heads] = await gossipLog.getClock()
				this.push({ update: { heads: heads.map(encodeId) } })
			})
			.catch((err) => {
				if (err.name === "UnsupportedProtocolError") {
					err.message = `remote was not serving topic ${gossipLog.topic}`
				}
				this.error = err
				throw err
			})
	}

	private async newStream(protocol: string): Promise<Stream> {
		this.log("opening new %s stream", protocol)
		const muxerStream = await this.muxer.newStream()
		const { stream } = await select(muxerStream, protocol, { log: this.log })
		return stream
	}

	public async close() {
		this.gossipLog.removeEventListener("message", this.handleMessage)
		await this.muxer.close()
		await this.duplex.close()
	}

	public isConnected(): boolean {
		// hardcode Websocket.OPEN === 1, because class isn't available in the browser
		return this.duplex.socket.readyState === 1
	}

	private push(event: Event) {
		this.eventSource.push(event)
	}

	private readonly handleMessage = ({ detail: { id, key, value, source } }: GossipLogEvents["message"]) => {
		this.log("handling message %s from source %o", id, source)
		if (source === undefined) {
			this.log("pushing %s to %s", id, this.sourceURL)
			this.push({ insert: { key, value } })
		}
	}

	private readonly handleProtocolStream = async ({ protocol, stream }: ProtocolStream<Stream>) => {
		if (protocol === this.syncProtocol) {
			this.gossipLog.serve((txn) => sync.Server.handleStream(txn, stream)).catch((err) => this.log(err))
		} else if (protocol === this.pushProtocol) {
			throw new Error("incoming push stream rejected")
		} else {
			throw new Error("unsupported protocol")
		}
	}

	private eventSink = async (events: AsyncIterable<Event>) => {
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

	private async handleInsertEvent({ key, value }: Event.Insert) {
		const signedMessage = this.gossipLog.decode(value, {
			source: { type: "push", peer: this.sourceURL },
		})

		assert(equals(key, signedMessage.key), "invalid key")

		this.log("handling insert %s", signedMessage.id)

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

	private async sync() {
		this.log("initiating merkle sync with %s", this.sourceURL)
		this.gossipLog.dispatchEvent(
			new CustomEvent("sync:status", {
				detail: { role: "client", status: "incomplete", peer: this.sourceURL },
			}),
		)

		do {
			let stream: Stream
			try {
				stream = await this.newStream(this.syncProtocol)
			} catch (err) {
				this.log.error("failed to open outgoing sync stream: %O", err)
				this.error = err
				return
			}

			this.log("opened outgoing sync stream %s", stream.id)

			// sync.Client
			const client = new sync.Client(stream)
			try {
				const result = await this.gossipLog.sync(client, { peer: this.sourceURL })
				if (result.complete) {
					this.gossipLog.dispatchEvent(
						new CustomEvent("sync:status", {
							detail: { role: "client", status: "complete", peer: this.sourceURL },
						}),
					)

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
