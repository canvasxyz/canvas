import type { PeerId } from "@libp2p/interface"
import { logger } from "@libp2p/logger"

import Database, * as sqlite from "better-sqlite3"

import { assert } from "./utils.js"

const now = () => BigInt(Math.ceil(Date.now() / 1000))

export type DiscoverResult = {
	cookie: Uint8Array
	registrations: { ns: string; signedPeerRecord: Uint8Array; ttl: bigint }[]
}

export class RegistrationStore {
	public readonly db: sqlite.Database

	private readonly log = logger(`canvas:rendezvous:store`)

	#interval = setInterval(() => this.gc(), 5 * 1000)

	#gc: sqlite.Statement<{ expiration: bigint }>
	#register: sqlite.Statement<{ peer: string; namespace: string; signed_peer_record: Uint8Array; expiration: bigint }>
	#unregister: sqlite.Statement<{ peer: string; namespace: string }>
	#discover: sqlite.Statement<
		{ start: bigint; namespace: string; expiration: bigint; limit: bigint },
		{ id: bigint; peer: string; signed_peer_record: Uint8Array; expiration: bigint }
	>

	constructor(path: string | null = null) {
		if (path !== null) {
			this.log("opening database at %s", path)
		} else {
			this.log("opening in-memory database")
		}

		this.db = new Database(path ?? ":memory:")
		this.db.defaultSafeIntegers(true)
		this.db.exec(
			`CREATE TABLE registrations (
  		  id INTEGER PRIMARY KEY AUTOINCREMENT,
  			peer TEXT NOT NULL,
  			namespace TEXT NOT NULL,
        signed_peer_record BLOB NOT NULL,
  			expiration INTEGER NOT NULL
  		)`,
		)

		this.db.exec(`CREATE INDEX expirations ON registrations(expiration)`)
		this.db.exec(`CREATE INDEX namespaces ON registrations(namespace, peer)`)
		this.db.exec(`CREATE INDEX peers ON registrations(peer, namespace)`)

		this.#gc = this.db.prepare(`DELETE FROM registrations WHERE expiration < :expiration`)

		this.#register = this.db.prepare(
			`INSERT INTO registrations(peer, namespace, signed_peer_record, expiration)
			  VALUES (:peer, :namespace, :signed_peer_record, :expiration)`,
		)

		this.#unregister = this.db.prepare(`DELETE FROM registrations WHERE peer = :peer AND namespace = :namespace`)

		this.#discover = this.db.prepare(
			`SELECT id, peer, signed_peer_record, expiration FROM registrations
			  WHERE id > :start AND namespace = :namespace AND expiration > :expiration
				ORDER BY id DESC LIMIT :limit`,
		)
	}

	public register(namespace: string, peerId: PeerId, signedPeerRecord: Uint8Array, ttl: bigint) {
		const expiration = now() + ttl
		this.#unregister.run({ peer: peerId.toString(), namespace })
		this.#register.run({
			peer: peerId.toString(),
			namespace,
			signed_peer_record: signedPeerRecord,
			expiration,
		})
	}

	public unregister(namespace: string, peerId: PeerId) {
		this.#unregister.run({ peer: peerId.toString(), namespace })
	}

	public discover(namespace: string, limit: bigint, cookie: Uint8Array | null): DiscoverResult {
		let start = 0n
		if (cookie !== null) {
			const { buffer, byteOffset, byteLength } = cookie
			assert(byteLength === 8, "invalid cookie")
			start = new DataView(buffer, byteOffset, byteLength).getBigUint64(0)
		}

		const expiration = now()
		const results = this.#discover.all({ start, namespace, expiration, limit })

		let lastId = 0n
		if (results.length > 0) {
			lastId = results[results.length - 1].id
		}

		const cookieBuffer = new ArrayBuffer(8)
		new DataView(cookieBuffer).setBigUint64(0, lastId)

		return {
			cookie: new Uint8Array(cookieBuffer),
			registrations: results.map((result) => ({
				ns: namespace,
				signedPeerRecord: result.signed_peer_record,
				ttl: result.expiration - expiration,
			})),
		}
	}

	public gc() {
		this.#gc.run({ expiration: now() })
	}

	public close() {
		clearInterval(this.#interval)
		this.db.close()
	}
}
