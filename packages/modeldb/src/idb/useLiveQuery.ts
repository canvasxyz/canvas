import { useEffect, useRef, useState } from "react"
import equal from "fast-deep-equal/es6/index.js"

import type { ModelValue, QueryParams } from "../types.js"
import { AbstractModelDB } from "../AbstractModelDB.js"

export function useLiveQuery<T extends ModelValue = ModelValue>(
	db: AbstractModelDB | null | undefined,
	modelName: string | null | undefined,
	query: QueryParams | null | undefined,
): T[] | null {
	const dbRef = useRef<AbstractModelDB | null>(db ?? null)
	const modelRef = useRef<string | null>(modelName ?? null)
	const queryRef = useRef<QueryParams | null>(query ?? null)
	const subscriptionRef = useRef<number | null>(null)

	const [results, setResults] = useState<null | T[]>(null)

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
			equal(queryRef.current, query) &&
			subscriptionRef.current !== null
		) {
			return
		}

		if (dbRef.current !== null && subscriptionRef.current !== null) {
			db.unsubscribe(subscriptionRef.current)
		}

		const { id } = db.subscribe(modelName, query, (results) => setResults(results as T[]))
		dbRef.current = db
		modelRef.current = modelName
		queryRef.current = query
		subscriptionRef.current = id
	}, [db, query])

	return results
}
