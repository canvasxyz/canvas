import { Database } from "@sqlite.org/sqlite-wasm"
import { AbstractSqliteDB, SqlitePrimitiveValue } from "@canvas-js/modeldb-sqlite-shared"
import { Query, Method } from "./utils.js"

export class SqliteDB extends AbstractSqliteDB {
	private readonly db: Database
	constructor(db: Database) {
		super()
		this.db = db
	}

	prepareQuery<R>(sql: string) {
		return new Query<R>(this.db, sql)
	}
	prepareMethod(sql: string) {
		return new Method(this.db, sql)
	}
	transaction(fn: () => void): void {
		this.transaction(fn)
	}
	close() {
		this.db.close()
	}
}
