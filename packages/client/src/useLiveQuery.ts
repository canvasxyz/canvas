import { useEffect, useMemo, useState } from "react"

import * as json from "@ipld/dag-json"

import type { ModelValue, QueryParams } from "@canvas-js/modeldb"

import { Client } from "./Client.js"

export function useLiveQuery<T extends ModelValue = ModelValue>(
	client: Client | null | undefined,
	model: string | null | undefined,
	query: Exclude<QueryParams, "include"> | null | undefined,
): T[] | null {
	const [results, setResults] = useState<T[] | null>(null)
	const queryString = useMemo(() => json.stringify(query), [query])

	useEffect(() => {
		if (!client || !model || !query) {
			return
		}

		const queryParams = new URLSearchParams({ model, query: queryString })
		const eventSource = new EventSource(`${client.host}/api/subscribe?${queryParams}`)
		eventSource.addEventListener("message", (event) => {
			setResults(json.parse(event.data))
		})

		return () => eventSource.close()
	}, [client, model, queryString])

	return results
}
