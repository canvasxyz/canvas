import { useEffect, useRef, useState } from "react"

import { deepEqual } from "@canvas-js/utils"
import type { AbstractModelDB, QueryParams, ModelSchema, DeriveModelType } from "@canvas-js/modeldb"

export function useLiveQuery<Schema extends ModelSchema, K extends keyof Schema, Q extends QueryParams>(
	db: AbstractModelDB | null | undefined,
	modelName: string | null | undefined,
	query: Q | null | undefined,
): DeriveModelType<Schema[K], {}, Q["include"]>[] | null {
	const dbRef = useRef<AbstractModelDB | null>(db ?? null)
	const modelRef = useRef<string | null>(modelName ?? null)
	const queryRef = useRef<QueryParams | null>(query ?? null)
	const subscriptionRef = useRef<number | null>(null)

	const [results, setResults] = useState<null | DeriveModelType<Schema[K]>[]>(null)

	useEffect(() => {
		// Unsubscribe from the cached database handle, if necessary
		if (
			db === null ||
			modelName === null ||
			query === null ||
			db === undefined ||
			modelName === undefined ||
			query === undefined
		) {
			if (dbRef.current !== null) {
				if (subscriptionRef.current !== null) {
					dbRef.current.unsubscribe(subscriptionRef.current)
					subscriptionRef.current = null
					setResults(null)
				}
			}

			dbRef.current = db ?? null
			modelRef.current = modelName ?? null
			queryRef.current = query ?? null
			return
		}

		if (
			dbRef.current === db &&
			modelRef.current === modelName &&
			deepEqual(queryRef.current, query) &&
			subscriptionRef.current !== null
		) {
			return
		}

		if (dbRef.current !== null && subscriptionRef.current !== null) {
			db.unsubscribe(subscriptionRef.current)
		}

		const { id } = db.subscribe(modelName, query, (results) => setResults(results as DeriveModelType<Schema[K]>[]))
		dbRef.current = db
		modelRef.current = modelName
		queryRef.current = query
		subscriptionRef.current = id
	}, [(db as any)?.isProxy ? null : db, JSON.stringify(query)])

	return results
}
