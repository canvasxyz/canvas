import { useState, useEffect, useMemo, useContext } from "react"

import { ModelValue } from "@canvas-js/interfaces"

import { CanvasContext } from "./CanvasContext.js"
import { compareObjects } from "./utils.js"

const routePattern = /^(\/:?[a-zA-Z0-9_]+)+$/

function getRouteURL(host: string, route: string, params: Record<string, ModelValue>): string {
	if (!routePattern.test(route)) {
		throw new Error("Invalid route")
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
	params: Record<string, ModelValue>,
	options: { subscribe?: boolean } = { subscribe: true },
	callback?: (data: T[] | null, error: Error | null) => void
): { error: Error | null; isLoading: boolean; data: T[] | null } {
	const { host, ws, data: applicationData } = useContext(CanvasContext)
	if (host === null) {
		throw new Error("No API endpoint provided! you must provide an API endpoint in a parent Canvas element.")
	}

	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)
	const [data, setData] = useState<T[] | null>(null)

	const url = useMemo(() => getRouteURL(host, route, params), [host, route, params])

	const readyState = ws?.readyState
	const subscribe = options.subscribe ?? true

	const listener = useMemo(
		() => (evt: MessageEvent) => {
			if (evt.data.toString() === "pong") return
			try {
				const message = JSON.parse(evt.data.toString())
				if (message.route === route && compareObjects(message.params, params)) {
					setData(message.data)
					setIsLoading(false)
					if (callback) setTimeout(() => callback(message.data, null))
				}
			} catch (err) {
				console.log("ws: failed to parse message", evt.data)
			}
		},
		[callback, params]
	)

	useEffect(() => {
		if (applicationData === null || ws === null) {
			return
		} else if (!applicationData.routes.includes(route)) {
			setError(new Error(`${applicationData.uri} has no route ${JSON.stringify(route)}`))
			setData(null)
			setIsLoading(false)
			if (callback) setTimeout(() => callback(null, error))
			return
		}

		setIsLoading(true)

		if (subscribe) {
			if (ws.readyState === ws.OPEN) {
				// console.log("ws: subscribing", url)
				ws.addEventListener("message", listener)
				ws.send(JSON.stringify({ action: "subscribe", data: { route, params } }))

				return () => {
					// console.log("ws: unsubscribing", url)
					ws.removeEventListener("message", listener)
					if (ws.readyState === ws.OPEN) {
						ws.send(JSON.stringify({ action: "unsubscribe", data: { route, params } }))
					}
				}
			}

			// const source = new EventSource(url)
			// source.onmessage = (message: MessageEvent<string>) => {
			// 	const data = JSON.parse(message.data)
			// 	setData(data)
			// 	setIsLoading(false)
			//  if (callback) callback(message.data, null)
			// }

			// source.onerror = (event) => {
			// 	console.warn("Connection error in EventSource subscription")
			// 	console.warn(event)
			// 	setIsLoading(true)
			//  if (callback) callback(null, new Error("Connection error in EventSource subscription"))
			// }

			// const handleBeforeUnload = () => source.close()
			// window.addEventListener("beforeunload", handleBeforeUnload)

			// return () => {
			// 	window.removeEventListener("beforeunload", handleBeforeUnload)
			// 	source.close()
			// }
		} else {
			fetch(url)
				.then((res) => res.json())
				.then((data) => {
					setError(null)
					setData(data)
					setIsLoading(false)
					if (callback) setTimeout(() => callback(data, null))
				})
				.catch((err) => {
					setError(err)
					setData(null)
					setIsLoading(false)
					if (callback) setTimeout(() => callback(null, err))
				})
		}
	}, [route, url, !!applicationData, subscribe, ws, readyState, callback])

	return { error, data, isLoading }
}
