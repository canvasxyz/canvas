import type { AtConfig, AtInit, JetstreamEvent } from "./types.js"
import { getConfig } from "./utils.js"

import WebSocket from 'ws'
import { ModelDB as SqliteModelDB } from "@canvas-js/modeldb-sqlite"
import { ModelDB as PostgresModelDB } from "@canvas-js/modeldb-pg"
import { AbstractModelDB } from "@canvas-js/modeldb"
import { mapValues } from "@canvas-js/utils"

export class AtObject {
	private config: Record<string, AtConfig>
	private db: AbstractModelDB

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
		try {
			this.ws = new WebSocket(url)
			
			this.ws.onopen = () => {
				console.log('Connected to Jetstream')
				this.reconnectAttempts = 0
				this.reconnectDelay = 1000
				options.onConnect?.()
			}
			
			this.ws.onmessage = (event) => {
				try {
					console.log('data:', event.data)
					const data: JetstreamEvent = JSON.parse(event.data.toString())
					this.handleEvent(data)
				} catch (error) {
					console.error('Error parsing Jetstream event:', error)
					options.onError?.(error as Error)
				}
			}
			
			this.ws.onclose = (event) => {
				console.log('Jetstream connection closed:', event.code, event.reason)
				options.onDisconnect?.()
				
				// Attempt to reconnect unless explicitly closed
				if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
					this.reconnectAttempts++
					console.log(`Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
					
					setTimeout(() => {
						this.connect(url, options)
					}, this.reconnectDelay)
					
					// Exponential backoff with jitter
					this.reconnectDelay = Math.min(this.reconnectDelay * 2 + Math.random() * 1000, 30000)
				}
			}
			
			this.ws.onerror = (error) => {
				console.error('Jetstream WebSocket error:', error)
				options.onError?.(new Error('WebSocket connection error'))
			}
			
		} catch (error) {
			console.error('Error creating WebSocket connection:', error)
			options.onError?.(error as Error)
		}
	}

	private handleEvent(event: JetstreamEvent) {
		if (event.kind !== 'commit' || !event.commit) return

		const { commit } = event
		const { collection, rkey, record, operation } = commit

		for (const [table, config] of Object.entries(this.config)) {
			if (config.nsid === collection) {
				if (config.filter && !config.filter(collection, rkey, record)) {
					continue
				}

				if (config.handler) {
					const recordData = operation === 'delete' ? null : record
					config.handler(collection, rkey, recordData, this.createDbProxy(table))
				} else {
					if (operation === 'delete') {
						console.log(`DB DELETE ${table}.${rkey}`)
					} else {
						console.log(`DB SET ${table}.${rkey}:`, record)
					}
				}
			}
		}
	}

	private createDbProxy(table: string) {
		return {
			set: (key: string, value: any) => {
				console.log(`DB SET ${table}.${key}:`, value)
			},
			get: (key: string) => {
				console.log(`DB GET ${table}.${key}`)
				return null
			},
			delete: (key: string) => {
				console.log(`DB DELETE ${table}.${key}`)
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
	}
}
