import type { AtConfig, AtInit, JetstreamEvent } from "./types.js"
import { getConfig } from "./utils.js"

import WebSocket from 'ws'
import debug from "weald"
import PQueue from "p-queue"

import { ModelDB as SqliteModelDB } from "@canvas-js/modeldb-sqlite"
import { ModelDB as PostgresModelDB } from "@canvas-js/modeldb-pg"
import { AbstractModelDB } from "@canvas-js/modeldb"
import { mapValues } from "@canvas-js/utils"

export class AtObject {
	public db: AbstractModelDB
	private config: Record<string, AtConfig>
	private log: typeof debug.log
	private handlerQueue: PQueue

	private ws?: WebSocket
	private reconnectAttempts = 0
	private maxReconnectAttempts = 5
	private reconnectDelay = 1000

	static async initialize(init: AtInit, path: string | null) {
		const config = getConfig(init)

		const dbConfig = {
			models: mapValues(config, () => ({ rkey: "primary", record: "json" } as const)),
			version: {
				"atobject": 1
			},
			// TODO: do we need an initial upgrade?
			upgrade: undefined,
			initialUpgradeVersion: undefined,
			initialUpgradeSchema: undefined,
			reset: true
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
	}

	listen(endpoint: string, options: {
		cursor?: string
		wantedDids?: string[]
		compress?: boolean
		onError?: (error: Error) => void
		onConnect?: () => void
		onDisconnect?: () => void
	} = {}) {
		const url = new URL(endpoint)
		
		if (url.pathname === '/') {
			url.pathname = '/subscribe'
		}

		const wantedCollections = Object.values(this.config).map(config => config.nsid)
		
		if (wantedCollections.length > 0) {
			wantedCollections.forEach(collection => {
				url.searchParams.append('wantedCollections', collection)
			})
		}
		
		if (options.wantedDids && options.wantedDids.length > 0) {
			options.wantedDids.forEach(did => {
				url.searchParams.append('wantedDids', did)
			})
		}
		
		if (options.cursor) {
			url.searchParams.set('cursor', options.cursor)
		}
		
		if (options.compress) {
			url.searchParams.set('compress', 'true')
		}

		this.connect(url.toString(), options)
	}

	private connect(url: string, options: {
		onError?: (error: Error) => void
		onConnect?: () => void
		onDisconnect?: () => void
	}) {
		const log = this.log
		try {
			this.ws = new WebSocket(url)
			
			this.ws.onopen = () => {
				log('Connected to Jetstream')
				this.reconnectAttempts = 0
				this.reconnectDelay = 1000
				options.onConnect?.()
			}
			
			this.ws.onmessage = (event) => {
				let data: JetstreamEvent
				try {
					log('data: %O', event.data)
					data = JSON.parse(event.data.toString())
				} catch (error) {
					log('Error parsing Jetstream event: %O', error)
					options.onError?.(error as Error)
					return
				}
				this.handleEvent(data)
			}
			
			this.ws.onclose = (event) => {
				log('Jetstream connection closed: %i, %O', event.code, event.reason)
				options.onDisconnect?.()
				
				// Attempt to reconnect unless explicitly closed
				if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
					this.reconnectAttempts++
					log(`Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
					
					setTimeout(() => {
						this.connect(url, options)
					}, this.reconnectDelay)
					
					// Exponential backoff with jitter
					this.reconnectDelay = Math.min(this.reconnectDelay * 2 + Math.random() * 1000, 30000)
				}
			}
			
			this.ws.onerror = (error) => {
				log('Jetstream WebSocket error: %O', error)
				options.onError?.(new Error('WebSocket connection error'))
			}
			
		} catch (error) {
			log('Error creating WebSocket connection: %O', error)
			options.onError?.(error as Error)
		}
	}

	private handleEvent(event: JetstreamEvent) {
		if (event.kind !== 'commit' || !event.commit) return

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
					const recordData = operation === 'delete' ? null : record
					const db = this.createDbProxy(table)
					this.handlerQueue.add(() => config.handler?.(collection, rkey, recordData, db))
				} else {
					if (operation === 'delete') {
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
			}
		}
	}

	disconnect() {
		if (this.ws) {
			this.ws.close(1000, 'Manual disconnect')
			this.ws = undefined
		}
	}

	close() {
		this.disconnect()
		this.handlerQueue.clear()
	}
}
