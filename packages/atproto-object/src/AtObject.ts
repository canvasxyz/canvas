import type { AtConfig, AtInit, JetstreamEvent } from "./types.js"
import { getConfig, findPdsEndpoint } from "./utils.js"
import { parseCarFile } from "./repo.js"

import WebSocket from "ws"
import debug from "weald"
import PQueue from "p-queue"
import { AtprotoHandleResolverNode } from "@atproto-labs/handle-resolver-node"

import { ModelDB as SqliteModelDB } from "@canvas-js/modeldb-sqlite"
import { ModelDB as PostgresModelDB } from "@canvas-js/modeldb-pg"
import { AbstractModelDB } from "@canvas-js/modeldb"
import { mapValues } from "@canvas-js/utils"

export class AtObject {
	public db: AbstractModelDB
	private config: Record<string, AtConfig>
	private log: typeof debug.log
	private handlerQueue: PQueue
	private backfillQueue: PQueue
	private handleResolver: AtprotoHandleResolverNode

	private ws?: WebSocket
	private reconnectAttempts = 0
	private maxReconnectAttempts = 5
	private reconnectDelay = 1000

	static async initialize(init: AtInit, path: string | null) {
		const config = getConfig(init)

		const dbConfig = {
			models: mapValues(config, () => ({ rkey: "primary", record: "json" }) as const),
			version: {
				atobject: 1,
			},
			// TODO: do we need an initial upgrade?
			upgrade: undefined,
			initialUpgradeVersion: undefined,
			initialUpgradeSchema: undefined,
			reset: true,
		}

		if (path?.startsWith("postgres://")) {
			const db = await PostgresModelDB.open(path, dbConfig)
			return new AtObject(config, db)
		} else {
			const db = await SqliteModelDB.open(path, dbConfig)
			return new AtObject(config, db)
		}
	}

	private constructor(config: Record<string, AtConfig>, db: AbstractModelDB) {
		this.config = config
		this.db = db
		this.log = debug.log
		this.handlerQueue = new PQueue({ concurrency: 1 })
		this.backfillQueue = new PQueue({ concurrency: 3 }) // Allow some concurrency for backfill operations
		this.handleResolver = new AtprotoHandleResolverNode()
	}

	listen(
		endpoint: string,
		options: {
			cursor?: string
			compress?: boolean
			onError?: (error: Error) => void
			onConnect?: () => void
			onDisconnect?: () => void
		} = {},
	) {
		const url = new URL(endpoint)

		if (url.pathname === "/") {
			url.pathname = "/subscribe"
		}

		// TODO: remove this once we switch to firehose, since we want to maintain latest
		// `rev` values even when a PDS commits operations outside the collections we are tracking.
		const wantedCollections = Object.values(this.config).map((config) => config.nsid)
		wantedCollections.forEach((collection) => {
			url.searchParams.append("wantedCollections", collection)
		})

		if (options.cursor) {
			url.searchParams.set("cursor", options.cursor)
		}

		if (options.compress !== false) {
			url.searchParams.set("compress", "true")
		}

		this.connect(url.toString(), options)
	}

	private connect(
		url: string,
		options: {
			onError?: (error: Error) => void
			onConnect?: () => void
			onDisconnect?: () => void
		},
	) {
		const log = this.log
		try {
			this.ws = new WebSocket(url)

			this.ws.onopen = () => {
				log("Connected to Jetstream")
				this.reconnectAttempts = 0
				this.reconnectDelay = 1000
				options.onConnect?.()
			}

			this.ws.onmessage = (event) => {
				let data: JetstreamEvent
				try {
					log("data: %O", event.data)
					data = JSON.parse(event.data.toString())
				} catch (error) {
					log("Error parsing Jetstream event: %O", error)
					options.onError?.(error as Error)
					return
				}
				this.handleEvent(data)
			}

			this.ws.onclose = (event) => {
				log("Jetstream connection closed: %i, %O", event.code, event.reason)
				options.onDisconnect?.()

				// Attempt to reconnect unless explicitly closed
				if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
					this.reconnectAttempts++
					log(
						`Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
					)

					setTimeout(() => {
						this.connect(url, options)
					}, this.reconnectDelay)

					// Exponential backoff with jitter
					this.reconnectDelay = Math.min(this.reconnectDelay * 2 + Math.random() * 1000, 30000)
				}
			}

			this.ws.onerror = (error) => {
				log("Jetstream WebSocket error: %O", error)
				options.onError?.(new Error("WebSocket connection error"))
			}
		} catch (error) {
			log("Error creating WebSocket connection: %O", error)
			options.onError?.(error as Error)
		}
	}

	private handleEvent(event: JetstreamEvent) {
		if (event.kind !== "commit" || !event.commit) return

		const { commit } = event
		const { collection, rkey, record, operation } = commit

		for (const [table, config] of Object.entries(this.config)) {
			if (config.nsid === collection) {
				if (config.filter) {
					try {
						if (!config.filter(collection, rkey, record)) {
							continue
						}
					} catch (err) {
						continue
					}
				}

				if (config.handler) {
					const recordData = operation === "delete" ? null : record
					const db = this.createDbProxy(table)
					this.handlerQueue.add(() => config.handler?.(collection, rkey, recordData, db))
				} else {
					if (operation === "delete") {
						this.db.delete(table, rkey)
						this.log(`DB DELETE ${table}.${rkey}`)
					} else {
						this.db.set(table, { rkey, record })
						this.log(`DB SET ${table}.${rkey}: %O`, record)
					}
				}
			}
		}
	}

	private createDbProxy(table: string) {
		return {
			set: (key: string, record: any) => {
				this.log(`DB SET ${table}: %O`, record)
				return this.db.set(table, record)
			},
			get: (key: string) => {
				this.log(`DB GET ${table}.${key}`)
				return this.db.get(table, key)
			},
			delete: (key: string) => {
				this.log(`DB DELETE ${table}.${key}`)
				return this.db.delete(table, key)
			},
		}
	}

	disconnect() {
		if (this.ws) {
			this.ws.close(1000, "Manual disconnect")
			this.ws = undefined
		}
	}

	close() {
		this.disconnect()
		this.handlerQueue.clear()
		this.backfillQueue.clear()
	}

	public async backfill(identifiers: string[]): Promise<void> {
		this.log("Starting backfill for %d identifiers", identifiers.length)

		const promises = identifiers.map((identifier) => this.backfillQueue.add(() => this.backfillIdentifier(identifier)))

		await Promise.allSettled(promises)
		this.log("Backfill completed for %d identifiers", identifiers.length)
	}

	private async backfillIdentifier(identifier: string): Promise<void> {
		try {
			const did = await this.resolveIdentifier(identifier)
			if (!did) {
				this.log("Failed to resolve identifier: %s", identifier)
				return
			}

			const pdsEndpoint = await findPdsEndpoint(did)
			if (!pdsEndpoint) {
				this.log("Failed to find PDS endpoint for DID: %s", did)
				return
			}

			// Fetch repository using com.atproto.sync.getRepo
			const repoUrl = `${pdsEndpoint}/xrpc/com.atproto.sync.getRepo?did=${encodeURIComponent(did)}`
			const response = await fetch(repoUrl, {
				method: "GET",
				signal: AbortSignal.timeout(30000), // TODO: timeout for repo sync
			})

			if (!response.ok) {
				throw new Error(`Failed to fetch repository: ${response.status} ${response.statusText}`)
			}

			const carBytes = await response.arrayBuffer()
			const records = await parseCarFile(new Uint8Array(carBytes))
			for (const record of records) {
				await this.handleBackfillRecord(did, record)
			}
			this.log("Successfully backfilled %s (%s)", identifier, did)
		} catch (error) {
			this.log("Error backfilling %s: %O", identifier, error)
		}
	}

	private async resolveIdentifier(identifier: string): Promise<string | null> {
		try {
			// If it's already a DID, return it as-is
			if (identifier.startsWith("did:plc:") || identifier.startsWith("did:web:")) {
				return identifier
			}

			// Clean up handle format (remove @ if present)
			let handle = identifier.startsWith("@") ? identifier.slice(1) : identifier
			handle = handle.toLowerCase().trim()

			// Use the official AT Protocol handle resolver
			const did = await this.handleResolver.resolve(handle)
			return did || null
		} catch (error) {
			this.log("Error resolving identifier %s: %O", identifier, error)
			return null
		}
	}

	private async handleBackfillRecord(did: string, record: { collection: string; rkey: string; record: any }): Promise<void> {
		const { collection, rkey, record: recordData } = record

		// Check if this collection is one we're tracking
		for (const [table, config] of Object.entries(this.config)) {
			if (config.nsid === collection) {
				// Apply filter if configured
				if (config.filter) {
					try {
						if (!config.filter(collection, rkey, recordData)) {
							continue
						}
					} catch (err) {
						continue
					}
				}

				// Use handler or default storage
				if (config.handler) {
					const db = this.createDbProxy(table)
					await this.handlerQueue.add(() => config.handler?.(collection, rkey, recordData, db))
				} else {
					await this.db.set(table, { rkey, record: recordData })
					this.log(`DB SET ${table}.${rkey}: %O`, recordData)
				}
			}
		}
	}
}
