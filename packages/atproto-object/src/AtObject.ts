import WebSocket from "ws"
import debug from "weald"
import PQueue from "p-queue"
import { AtprotoHandleResolverNode } from "@atproto-labs/handle-resolver-node"

import { ModelDB as SqliteModelDB } from "@canvas-js/modeldb-sqlite"
import { ModelDB as PostgresModelDB } from "@canvas-js/modeldb-pg"
import { AbstractModelDB } from "@canvas-js/modeldb"
import { mapValues } from "@canvas-js/utils"

import type { AtConfig, AtInit, FirehoseEvent } from "./types.js"
import { getConfig, buildFirehoseUrl } from "./utils.js"
import {
	getPdsEndpoint,
	parseFirehoseFrame,
	extractCommitOperations,
	parseCarFile,
	extractRecordFromCarByPath,
} from "./repo.js"

export class AtObject {
	public db: AbstractModelDB
	public firstSeq: number | null
	public lastSeq: number | null

	private config: Record<string, AtConfig>
	private wantedCollections: string[]

	// Progress tracking for backfill
	private targetSeq: number | null = null
	private startSeq: number | null = null
	private progressTimer: NodeJS.Timeout | null = null
	private startTime: number | null = null

	private trace: typeof debug.log
	private log: typeof debug.log

	private handlerQueue: PQueue
	private backfillQueue: PQueue
	private handleResolver: AtprotoHandleResolverNode

	private ws?: WebSocket
	private reconnectAttempts = 0
	private reconnectDelay = 1000
	private reconnectionTimeout?: NodeJS.Timeout

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

	static async getCurrentCursor(endpoint = "wss://bsky.network", timeout = 10000): Promise<number> {
		return new Promise((resolve, reject) => {
			const url = buildFirehoseUrl(endpoint)
			const ws = new WebSocket(url)
			ws.binaryType = "arraybuffer"

			const timer = setTimeout(() => {
				ws.close()
				reject(new Error("Timeout waiting for firehose event"))
			}, timeout)

			ws.onmessage = (event) => {
				try {
					const data = new Uint8Array(event.data as ArrayBuffer)
					const firehoseEvent = parseFirehoseFrame(data)

					if (firehoseEvent && firehoseEvent.kind === "commit") {
						const seq = firehoseEvent.commit.seq
						clearTimeout(timer)
						ws.close(1000, "Got sequence number")
						resolve(seq)
					}
				} catch (error) {
					clearTimeout(timer)
					ws.close()
					reject(error)
				}
			}

			ws.onclose = (event) => {
				clearTimeout(timer)
				if (event.code !== 1000) {
					reject(new Error(`WebSocket closed unexpectedly: ${event.code} ${event.reason}`))
				}
			}

			ws.onerror = (error) => {
				clearTimeout(timer)
				reject(new Error("WebSocket connection error"))
			}
		})
	}

	private constructor(config: Record<string, AtConfig>, db: AbstractModelDB) {
		this.firstSeq = null
		this.lastSeq = null
		this.config = config
		this.wantedCollections = Object.values(config).map((config) => config.nsid)
		this.db = db
		this.trace = debug("atobject:trace")
		this.log = debug("atobject:log")
		this.handlerQueue = new PQueue({ concurrency: 1 })
		this.backfillQueue = new PQueue({ concurrency: 3 }) // Allow some concurrency for backfill operations
		this.handleResolver = new AtprotoHandleResolverNode()
	}

	listen(
		endpoint: string,
		options: {
			onError?: (error: Error) => void
			onConnect?: () => void
			onDisconnect?: () => void
		} = {},
	) {
		const url = buildFirehoseUrl(endpoint)
		this.log("Connecting to AT Protocol firehose: %s", url)

		this.connectFirehose(url, options)
	}

	async backfill(
		endpoint: string,
		cursor: string,
		options: {
			onError?: (error: Error) => void
			onConnect?: () => void
			onDisconnect?: () => void
		} = {},
	) {
		this.log("Getting current cursor to track progress...")

		// Get current cursor to track progress
		const currentCursor = await AtObject.getCurrentCursor(endpoint)
		const startCursor = parseInt(cursor)

		this.targetSeq = currentCursor
		this.startSeq = startCursor
		this.startTime = Date.now()

		const totalRecords = currentCursor - startCursor
		this.log(
			"Starting from cursor %d, current cursor is %d (%d records behind)",
			startCursor,
			currentCursor,
			totalRecords,
		)

		// Set up progress tracking timer
		this.progressTimer = setInterval(() => {
			if (this.lastSeq !== null && this.targetSeq !== null && this.startSeq !== null && this.startTime !== null) {
				const recordsLeft = this.targetSeq - this.lastSeq

				if (recordsLeft <= 0) {
					this.log("✅ Caught up! Now at sequence", this.lastSeq)
					// Clear progress tracking
					if (this.progressTimer) {
						clearInterval(this.progressTimer)
						this.progressTimer = null
					}
					this.targetSeq = null
					this.startSeq = null
					this.startTime = null
				} else {
					// Calculate progress based on records that will be synced during this run
					const totalRecords = this.firstSeq !== null ? this.targetSeq - this.firstSeq : this.targetSeq - this.startSeq
					const processed = this.firstSeq !== null ? this.lastSeq - this.firstSeq : this.lastSeq - this.startSeq
					const progress = totalRecords > 0 ? (processed / totalRecords) * 100 : 0

					// Calculate time estimation
					const elapsedTime = Date.now() - this.startTime
					const elapsedSeconds = elapsedTime / 1000
					let timeLeftStr = ""

					if (processed > 0 && elapsedSeconds > 0) {
						const recordsPerSecond = processed / elapsedSeconds
						const timeLeftSeconds = recordsLeft / recordsPerSecond

						if (timeLeftSeconds < 60) {
							timeLeftStr = `~${Math.round(timeLeftSeconds)}s left`
						} else if (timeLeftSeconds < 3600) {
							timeLeftStr = `~${Math.round(timeLeftSeconds / 60)}m left`
						} else {
							const hours = Math.floor(timeLeftSeconds / 3600)
							const minutes = Math.round((timeLeftSeconds % 3600) / 60)
							timeLeftStr = `~${hours}h ${minutes}m left`
						}
					}

					console.log(
						`📊 Progress: ${processed}/${totalRecords} records processed (${progress.toFixed(1)}%), ${timeLeftStr}`,
					)
				}
			}
		}, 1000)

		const url = buildFirehoseUrl(endpoint, cursor)
		this.log("Connecting to AT Protocol firehose: %s", url)

		this.connectFirehose(url, options)
	}

	private connectFirehose(
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
			this.ws.binaryType = "arraybuffer"

			this.ws.onopen = () => {
				log("Connected to AT Protocol firehose")
				this.reconnectAttempts = 0
				this.reconnectDelay = 1000

				// Clear any pending reconnection timeout
				if (this.reconnectionTimeout) {
					clearTimeout(this.reconnectionTimeout)
					this.reconnectionTimeout = undefined
				}

				options.onConnect?.()
			}

			this.ws.onmessage = (event) => {
				try {
					const data = new Uint8Array(event.data as ArrayBuffer)
					const firehoseEvent = parseFirehoseFrame(data)

					if (firehoseEvent) {
						this.handleFirehoseEvent(firehoseEvent)
					}
				} catch (error) {
					log("Error parsing firehose event: %O", error)
					options.onError?.(error as Error)
				}
			}

			this.ws.onclose = (event) => {
				log("Firehose connection closed: %i, %O", event.code, event.reason)
				options.onDisconnect?.()

				if (event.code !== 1000 && this.reconnectAttempts) {
					this.reconnectAttempts++
					log(`Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`)

					this.reconnectionTimeout = setTimeout(() => this.connectFirehose(url, options), this.reconnectDelay)
					this.reconnectDelay = Math.min(this.reconnectDelay * 2 + Math.random() * 1000, 30000)
				}
			}

			this.ws.onerror = (error) => {
				log("Firehose WebSocket error: %O", error)
				options.onError?.(new Error("WebSocket connection error"))
			}
		} catch (error) {
			log("Error creating WebSocket connection: %O", error)
			options.onError?.(error as Error)
		}
	}

	private async handleFirehoseEvent(event: FirehoseEvent) {
		if (event.kind === "error") {
			this.log("Firehose error: %s - %s", event.error.error, event.error.message)
			return
		}

		if (event.kind === "info") {
			this.log("Firehose info: %s - %s", event.info.name, event.info.message)
			return
		}

		if (event.kind === "identity") {
			this.log("Identity event: %s -> %s", event.identity.did, event.identity.handle)
			return
		}

		if (event.kind === "account") {
			this.log("Account event: %s -> active: %s", event.account.did, event.account.active)
			return
		}

		if (event.kind === "commit") {
			const { commit } = event
			if (this.firstSeq === null) {
				this.firstSeq = event.commit.seq
			}
			this.lastSeq = event.commit.seq

			this.log(
				"Commit event (%s): %s -> %s",
				event.commit.seq,
				event.commit.repo,
				event.commit.ops.map((c) => c.action + " " + c.path).join(", "),
			)

			const operations = extractCommitOperations(commit)

			for (const op of operations) {
				const { collection, rkey, action } = op

				if (this.wantedCollections.indexOf(collection) === -1) continue

				for (const [table, config] of Object.entries(this.config)) {
					if (config.nsid === collection) {
						let record: any = null
						if (action !== "delete" && commit.blocks && commit.blocks.length > 0) {
							try {
								record = await extractRecordFromCarByPath(commit.blocks, `${collection}/${rkey}`, this.log)
							} catch (error) {
								this.log("Error extracting record from CAR: %O", error)
								continue
							}
						}

						this.trace(
							"New committed op: repo=%s, rev=%s, since=%s, seq=%d, %O %O",
							commit.repo,
							commit.rev,
							commit.since,
							commit.seq,
							op,
							record,
						)

						if (config.filter) {
							try {
								if (!config.filter(collection, rkey, record, commit)) {
									continue
								}
							} catch (err) {
								continue
							}
						}

						if (config.handler) {
							const recordData = action === "delete" ? null : record
							const db = this.createDbProxy(table)
							this.handlerQueue.add(() => config.handler?.call({ commit }, collection, rkey, recordData, db))
						} else {
							if (action === "delete") {
								this.handlerQueue.add(() => this.db.delete(table, rkey))
								this.trace(`DB DELETE ${table}.${rkey}`)
							} else if (record) {
								this.handlerQueue.add(() => this.db.set(table, { rkey, record }))
								this.trace(`DB SET ${table}.${rkey}: %O`, record)
							}
						}
					}
				}
			}
		}
	}

	private createDbProxy(table: string) {
		return {
			set: (key: string, record: any) => {
				this.trace(`DB SET ${table}: %O`, record)
				return this.db.set(table, record)
			},
			get: (key: string) => {
				this.trace(`DB GET ${table}.${key}`)
				return this.db.get(table, key)
			},
			delete: (key: string) => {
				this.trace(`DB DELETE ${table}.${key}`)
				return this.db.delete(table, key)
			},
		}
	}

	public async backfillUsers(identifiers: string[]): Promise<void> {
		this.log("Starting backfill for %d identifiers", identifiers.length)

		const promises = identifiers.map((identifier) => this.backfillQueue.add(() => this.backfillUser(identifier)))

		await Promise.allSettled(promises)
		this.log("Backfill completed for %d identifiers", identifiers.length)
	}

	private async backfillUser(identifier: string): Promise<void> {
		try {
			const did = await this.resolveIdentifier(identifier)
			if (!did) {
				this.log("Failed to resolve identifier: %s", identifier)
				return
			}

			const pdsEndpoint = await getPdsEndpoint(did)
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
				await this.handleBackfillRecord(record)
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

			const did = await this.handleResolver.resolve(handle)
			return did || null
		} catch (error) {
			this.log("Error resolving identifier %s: %O", identifier, error)
			return null
		}
	}

	private async handleBackfillRecord(record: { collection: string; rkey: string; record: any }): Promise<void> {
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

				if (config.handler) {
					const db = this.createDbProxy(table)
					await this.handlerQueue.add(() => config.handler?.call(null, collection, rkey, recordData, db))
				} else {
					await this.db.set(table, { rkey, record: recordData })
					this.trace(`DB SET ${table}.${rkey}: %O`, recordData)
				}
			}
		}
	}

	close() {
		if (this.ws) {
			this.ws.close(1000, "Manual disconnect")
			this.ws = undefined
		}
		if (this.reconnectionTimeout) {
			clearTimeout(this.reconnectionTimeout)
			this.reconnectionTimeout = undefined
		}
		if (this.progressTimer) {
			clearInterval(this.progressTimer)
			this.progressTimer = null
		}
		this.targetSeq = null
		this.startSeq = null
		this.startTime = null

		this.handlerQueue.clear()
		this.backfillQueue.clear()
	}
}
