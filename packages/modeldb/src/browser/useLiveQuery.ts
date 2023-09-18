import { useEffect, useRef, useState } from "react"
import equal from "fast-deep-equal/es6/index.js"

import type { ModelValue, QueryParams } from "../types.js"
import { AbstractModelDB } from "../AbstractModelDB.js"

export function useLiveQuery(
	db: AbstractModelDB | null,
	modelName: string | null,
	query: QueryParams | null
): ModelValue[] | null {
	const dbRef = useRef<AbstractModelDB | null>(db)
	const modelRef = useRef<string | null>(modelName)
	const queryRef = useRef<QueryParams | null>(query)
	const subscriptionRef = useRef<number | null>(null)

	const [results, setResults] = useState<null | ModelValue[]>(null)

	useEffect(() => {
		// Unsubscribe from the cached database handle, if necessary
		if (db === null || modelName === null || query === null) {
			if (dbRef.current !== null) {
				if (subscriptionRef.current !== null) {
					dbRef.current.unsubscribe(subscriptionRef.current)
					subscriptionRef.current = null
					setResults(null)
				}
			}

			dbRef.current = db
			modelRef.current = modelName
			queryRef.current = query
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

		const { id } = db.subscribe(modelName, query, (results) => setResults(results))
		dbRef.current = db
		modelRef.current = modelName
		queryRef.current = query
		subscriptionRef.current = id
	}, [db, query])

	return results
}
