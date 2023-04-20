import { useState, useEffect, useContext, useRef } from "react"

import { useDebouncedCallback } from "use-debounce"
import { CoreAPI, ModelValue } from "@canvas-js/interfaces"

import { CanvasContext } from "./CanvasContext.js"
import { compareObjects } from "./utils.js"

export function useRoute<T extends Record<string, ModelValue> = Record<string, ModelValue>>(
	route: string,
	params: Record<string, ModelValue>,
	options: { subscribe?: boolean } = { subscribe: true }
): { error: Error | null; isLoading: boolean; data: T[] | null } {
	const { api } = useContext(CanvasContext)

	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)
	const [data, setData] = useState<T[] | null>(null)

	const subscribe = options.subscribe ?? true

	const refetch = useDebouncedCallback(
		(api: CoreAPI, route: string, params: Record<string, ModelValue>) => {
			setIsLoading(true)
			api
				.getRoute<T>(route, params)
				.then((results) => setData(results))
				.catch((err) => setError(err))
				.finally(() => setIsLoading(false))
		},
		500,
		{ leading: true, trailing: true }
	)

	// Get useEffect to perform a deep comparision of params:
	const routeParamToken = JSON.stringify(params)

	useEffect(() => {
		if (api === null) {
			return
		}
		refetch(api, route, params)

		if (subscribe) {
			const listener = ({}: Event) => refetch(api, route, params)
			api.addEventListener("update", listener)
			return () => {
				api.removeEventListener("update", listener)
			}
		}
	}, [api, route, routeParamToken])

	return { error, data, isLoading }
}
