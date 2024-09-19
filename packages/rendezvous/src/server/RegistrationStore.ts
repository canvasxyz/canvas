import { MINUTES } from "@canvas-js/utils"
import { PeerId } from "@libp2p/interface"
import Database, * as sqlite from "better-sqlite3"

export class RegistrationStore {
	public readonly db: sqlite.Database

	#interval = setInterval(() => this.gc(), 5 * MINUTES)
	#register: sqlite.Statement
	#unregister: sqlite.Statement
	#discover: sqlite.Statement
	#gc: sqlite.Statement

	constructor() {
		this.db = new Database(":memory:")
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

		this.#register = this.db.prepare(
			`INSERT INTO registrations(peer, namespace, signed_peer_record, expiration)
			  VALUES (:peer, :namespace, :signed_peer_record, :expiration)`,
		)

		this.#unregister = this.db.prepare(`DELETE FROM registrations WHERE peer = :peer AND namespace = :namespace`)

		this.#discover = this.db.prepare(
			`SELECT * FROM registrations
			  WHERE id >= :start AND namespace = :namespace AND expiration > :expiration
				ORDER BY id DESC LIMIT :limit`,
		)

		this.#gc = this.db.prepare(`DELETE FROM registrations WHERE expiration < :expiration`)
	}

	public register(peerId: PeerId, namespace: string, signedPeerRecord: Uint8Array, ttl: number) {
		const expiration = Date.now() + ttl * 1000
		this.#unregister.run({ peer: peerId.toString(), namespace })
		this.#register.run({ peer: peerId.toString(), namespace, signed_peer_record: signedPeerRecord, expiration })
	}

	public unregister(peerId: PeerId, namespace: string) {
		this.#unregister.run({ peer: peerId.toString(), namespace })
	}

	public discover(namespace: string, cookie: number, limit: number): { registrations: {}[]; cookie: number } {}

	public gc() {
		this.#gc.run({ expiration: Date.now() })
	}

	public close() {
		clearInterval(this.#interval)
		this.db.close()
	}
}
