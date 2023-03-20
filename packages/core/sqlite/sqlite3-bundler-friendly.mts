export namespace oo1 {
	export declare type Value = null | string | number | Uint8Array

	export declare class DB {
		constructor(path?: string)
		close(): void
		exec(sql: string): void
		exec({}: { sql: string; returnValue: "resultRows" }): Value[][]
		exec<T extends Record<string, Value> = Record<string, Value>>({}: {
			sql: string
			returnValue: "resultRows"
			rowMode: "object"
		}): T[]
		prepare(sql: string): Statement
		transaction(callback: (db: DB) => void): void
	}

	export declare class Statement {
		private constructor()
		getParamIndex(name: string): number | undefined
		finalize(): void
		reset(): void
		bind(params: Value[] | Record<string, Value>): void
		step(): boolean
		stepReset(): boolean
		get<T extends Record<string, Value> = Record<string, Value>>({}: Record<never, never>): T
	}
}

interface SQLite3 {
	oo1: typeof oo1
}

declare function getSQL(): Promise<SQLite3>

export default getSQL
