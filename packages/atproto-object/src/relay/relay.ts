import WebSocket from "ws"
import debug from "weald"
import PQueue from "p-queue"
import { AtprotoHandleResolverNode } from "@atproto-labs/handle-resolver-node"

import type { FirehoseEvent } from "../types.js"
import { buildFirehoseUrl } from "../utils/utils.js"
import { resolvePredicateToFilters, matchesAnyFilter } from "../utils/filter.js"
import {
	getPdsEndpoint,
	parseFirehoseFrame,
	extractCommitOperations,
	parseCarFile,
	extractRecordFromCarByPath,
} from "../utils/repo.js"
import type { AtObject } from "../AtObject.js"

export class Relay {
	private atObject: AtObject

	// Progress tracking for backfill
	private targetSeq: number | null = null
	private startSeq: number | null = null
	private progressTimer: NodeJS.Timeout | null = null
	private startTime: number | null = null
	private backfillResolve: (() => void) | null = null

	private trace: typeof debug.log
	private log: typeof debug.log

	private backfillQueue: PQueue
	private handleResolver: AtprotoHandleResolverNode

	private ws?: WebSocket
	private reconnectAttempts = 0
	private reconnectDelay = 1000
	private reconnectionTimeout?: NodeJS.Timeout

	constructor(atObject: AtObject) {
		this.atObject = atObject
		this.trace = debug("atobject:trace")
		this.log = (message: string, ...args: any[]) => {
			console.log(`[atobject] ${message}`, ...args)
		}
		this.backfillQueue = new PQueue({ concurrency: 3 })
		this.handleResolver = new AtprotoHandleResolverNode()
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

	listen(
		endpoint: string,
		options: {
			onError?: (error: Error) => void
			onConnect?: () => void
			onDisconnect?: () => void
		} = {},
	) {
		const url = buildFirehoseUrl(endpoint)
		this.trace("Connecting to AT Protocol firehose: %s", url)

		this.connectFirehose(url, options)
	}

	async backfill(
		endpoint: string,
		cursor: string | number,
		options: {
			onError?: (error: Error) => void
			onConnect?: () => void
			onDisconnect?: () => void
		} = {},
	): Promise<void> {
		const currentCursor = await Relay.getCurrentCursor(endpoint)
		await new Promise((resolve) => setTimeout(resolve, 1000))
		return new Promise<void>((resolve, reject) => {
			let startCursor = typeof cursor === "number" ? cursor : parseInt(cursor, 10)
			if (startCursor < 0) {
				startCursor = currentCursor + startCursor
			}

			this.targetSeq = currentCursor
			this.startSeq = startCursor
			this.startTime = Date.now()

			const totalRecords = currentCursor - startCursor
			this.log("Starting backfill from %d up to %d (%d records)", startCursor, currentCursor, totalRecords)

			// Store resolve function to call when backfill completes
			this.backfillResolve = resolve

			// Set up progress tracking timer
			this.progressTimer = setInterval(() => {
				if (
					this.atObject.lastSeq !== null &&
					this.targetSeq !== null &&
					this.startSeq !== null &&
					this.startTime !== null
				) {
					const recordsLeft = this.targetSeq - this.atObject.lastSeq

					if (recordsLeft <= 0) {
						this.log(" Caught up! Now at sequence", this.atObject.lastSeq)
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
						const totalRecords =
							this.atObject.firstSeq !== null ? this.targetSeq - this.atObject.firstSeq : this.targetSeq - this.startSeq
						const processed =
							this.atObject.firstSeq !== null
								? this.atObject.lastSeq - this.atObject.firstSeq
								: this.atObject.lastSeq - this.startSeq
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

						this.log(
							`Progress: ${processed}/${totalRecords} records processed (${progress.toFixed(1)}%), ${timeLeftStr}`,
						)
					}
				}
			}, 1000)

			const url = buildFirehoseUrl(endpoint, startCursor.toString())
			this.trace("Connecting to AT Protocol firehose: %s", url)

			const extendedOptions = {
				...options,
				onError: (error: Error) => {
					options.onError?.(error)
					reject(error)
				},
			}

			this.connectFirehose(url, extendedOptions)
		})
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
		const trace = this.trace
		try {
			this.ws = new WebSocket(url)
			this.ws.binaryType = "arraybuffer"

			this.ws.onopen = () => {
				trace("Connected to AT Protocol firehose")
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
				trace("Firehose connection closed with code %i %s", event.code, event.reason)
				options.onDisconnect?.()

				if (event.code !== 1000 && this.reconnectAttempts < 5) {
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
			this.trace("Firehose error: %s - %s", event.error.error, event.error.message)
			return
		}

		if (event.kind === "info") {
			this.trace("Firehose info: %s - %s", event.info.name, event.info.message)
			return
		}

		if (event.kind === "identity") {
			this.trace("Identity event: %s -> %s", event.identity.did, event.identity.handle)
			return
		}

		if (event.kind === "account") {
			this.trace("Account event: %s -> active: %s", event.account.did, event.account.active)
			return
		}

		if (event.kind === "commit") {
			const { commit } = event
			if (this.atObject.firstSeq === null) {
				this.atObject.firstSeq = event.commit.seq
			}
			this.atObject.lastSeq = event.commit.seq

			// If we're in backfill mode and have reached our target, close the connection
			if (this.targetSeq !== null && this.atObject.lastSeq >= this.targetSeq) {
				if (this.ws) {
					this.ws.close(1000, "Backfill complete")
				}
				if (this.backfillResolve) {
					this.log("Backfill to %d complete!", this.targetSeq)
					this.backfillResolve()
					this.backfillResolve = null
				}
				return
			}

			this.trace(
				"Commit event (%s): %s -> %s",
				event.commit.seq,
				event.commit.repo,
				event.commit.ops.map((c) => c.action + " " + c.path).join(", "),
			)

			const operations = extractCommitOperations(commit)

			for (const op of operations) {
				const { collection, rkey, action } = op

				if (this.atObject.wantedCollections.indexOf(collection) === -1) continue

				for (const [table, config] of Object.entries(this.atObject.config)) {
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

						if (config.predicate) {
							const filters = resolvePredicateToFilters(config.predicate)
							const matches = await matchesAnyFilter(filters, record, rkey, commit.repo, this.atObject.db)
							if (!matches) {
								continue
							}
						}

						if (config.filter) {
							try {
								if (!config.filter(record, collection, rkey, commit)) {
									continue
								}
							} catch (err) {
								continue
							}
						}

						if (config.handler) {
							const recordData = action === "delete" ? null : record
							const db = this.atObject.createDbProxy(table)
							const creator = commit.repo
							this.atObject.handlerQueue.add(() =>
								config.handler?.call({ commit, creator, nsid: collection, rkey, db }, db, recordData, creator, rkey),
							)
						} else {
							if (action === "delete") {
								this.atObject.handlerQueue.add(() => this.atObject.db.delete(table, rkey))
								this.trace(`DB DELETE ${table}.${rkey}`)
							} else if (record) {
								this.atObject.handlerQueue.add(() => this.atObject.db.set(table, { rkey, record }))
								this.trace(`DB SET ${table}.${rkey}: %O`, record)
							}
						}
					}
				}
			}
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

			const did = await this.handleResolver.resolve(handle)
			return did || null
		} catch (error) {
			this.log("Error resolving identifier %s: %O", identifier, error)
			return null
		}
	}

	private async handleBackfillRecord(
		repo: string,
		record: { collection: string; rkey: string; record: any },
	): Promise<void> {
		const { collection, rkey, record: recordData } = record

		// Check if this collection is one we're tracking
		for (const [table, config] of Object.entries(this.atObject.config)) {
			if (config.nsid === collection) {
				if (config.predicate) {
					const filters = resolvePredicateToFilters(config.predicate)
					if (!(await matchesAnyFilter(filters, record, rkey, repo, this.atObject.db))) {
						continue
					}
				}

				if (config.filter) {
					try {
						if (!config.filter(recordData, collection, rkey)) {
							continue
						}
					} catch (err) {
						continue
					}
				}

				if (config.handler) {
					const db = this.atObject.createDbProxy(table)
					const creator = repo
					const nsid = collection
					await this.atObject.handlerQueue.add(() =>
						config.handler?.call({ creator, nsid, rkey, db }, db, recordData, creator, rkey),
					)
				} else {
					await this.atObject.db.set(table, { rkey, record: recordData })
					this.trace(`DB SET ${table}.${rkey}: %O`, recordData)
				}
			}
		}
	}

	close() {
		if (this.ws) {
			// Check WebSocket state before closing to avoid errors
			// 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
			if (this.ws.readyState === 0 || this.ws.readyState === 1) {
				this.ws.close(1000, "Manual disconnect")
			}
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
		this.backfillResolve = null

		this.backfillQueue.clear()
	}
}
