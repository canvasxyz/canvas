import * as sqlite from "better-sqlite3"
import { AbstractSqliteDB, SqlitePrimitiveValue } from "@canvas-js/modeldb-sqlite-shared"
import { Query, Method } from "./utils.js"

export class SqliteDB extends AbstractSqliteDB {
	private readonly db: sqlite.Database
	constructor(db: sqlite.Database) {
		super()
		this.db = db
	}

	prepareQuery<P extends { [column: string]: SqlitePrimitiveValue }, R>(sql: string) {
		return new Query<P, R>(this.db, sql)
	}
	prepareMethod<P extends { [column: string]: SqlitePrimitiveValue }>(sql: string) {
		return new Method<P>(this.db, sql)
	}
	transaction(fn: () => void): void {
		this.transaction(fn)
	}
	close() {
		this.db.close()
	}
}
