import { SqlStorage } from "@cloudflare/workers-types"
import { AbstractSqliteDB } from "@canvas-js/modeldb/utils"
import { Query, Method } from "./utils.js"

export class SqliteDB extends AbstractSqliteDB {
	private readonly db: SqlStorage
	constructor(db: SqlStorage) {
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
		// transactions are not supported by SqlStorage database interface
	}
	close() {
		// no close method
	}
}
