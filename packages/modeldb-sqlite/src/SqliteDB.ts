import * as sqlite from "better-sqlite3"
import { AbstractSqliteDB } from "@canvas-js/modeldb/utils"
import { Query, Method } from "./utils.js"

export class SqliteDB extends AbstractSqliteDB {
	private readonly db: sqlite.Database
	constructor(db: sqlite.Database) {
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
