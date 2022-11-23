import { useState, useEffect, useMemo, useContext } from "react"

import { ModelValue } from "@canvas-js/interfaces"

import { CanvasContext } from "./CanvasContext.js"

const routePattern = /^(\/:?[a-zA-Z0-9_]+)+$/

function getRouteURL(host: string, route: string, params: Record<string, null | boolean | number | string>): string {
	if (!routePattern.test(route)) {
		throw new Error("invalid route")
	}

	const queryParams = { ...params }

	const path = route.slice(1).split("/")
	const pathComponents = path.map((component) => {
		if (component.startsWith(":")) {
			const value = params[component.slice(1)]
			if (value === undefined) {
				throw new Error(`missing parameter ${component}`)
			} else if (typeof value !== "string") {
				throw new Error(`URL parameter ${component} must be a string`)
			}

			delete queryParams[component.slice(1)]
			return encodeURIComponent(value)
		} else {
			return component
		}
	})

	if (host.endsWith("/")) {
		host = host.slice(0, -1)
	}

	// add the remainder of the params object to as URI-encoded JSON query params
	const queryComponents = Object.entries(queryParams).map(
		([key, value]) => `${key}=${encodeURIComponent(JSON.stringify(value))}`
	)

	if (queryComponents.length > 0) {
		return `${host}/${pathComponents.join("/")}?${queryComponents.join("&")}`
	} else {
		return `${host}/${pathComponents.join("/")}`
	}
}

export function useRoute<T extends Record<string, ModelValue> = Record<string, ModelValue>>(
	route: string,
	params: Record<string, string | number | null>
): { error: Error | null; data: T[] | null } {
	const { host, data: applicationData } = useContext(CanvasContext)
	if (host === null) {
		throw new Error("No API endpoint provided! you must provide an API endpoint in a parent Canvas element.")
	}

	const [error, setError] = useState<Error | null>(null)
	const [data, setData] = useState<T[] | null>(null)

	const url = useMemo(() => {
		if (applicationData === null) {
			return null
		} else if (applicationData.routes.includes(route)) {
			return getRouteURL(host, route, params)
		} else {
			setError(new Error(`${applicationData.uri} has no route ${JSON.stringify(route)}`))
			return null
		}
	}, [host, applicationData, route, params])

	useEffect(() => {
		if (url === null) {
			return
		}

		const source = new EventSource(url)
		source.onmessage = (message: MessageEvent<string>) => {
			const data = JSON.parse(message.data)
			setData(data)
			setError(null)
		}

		source.onerror = (event) => {
			console.error("Connection error in EventSource subscription:", event)
			setError(new Error("Connection error"))
		}

		const handleBeforeUnload = () => source.close()
		window.addEventListener("beforeunload", handleBeforeUnload)

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload)
			source.close()
		}
	}, [url])

	return { error, data }
}
