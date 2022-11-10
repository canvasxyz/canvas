import { useState, useEffect, useMemo, useContext } from "react"

import { ModelValue } from "@canvas-js/interfaces"

import { CanvasContext } from "./CanvasContext.js"

const routePattern = /^(\/:?[a-zA-Z0-9_]+)+$/

function getRouteURL(host: string, route: string, params: Record<string, string>): string {
	if (!routePattern.test(route)) {
		throw new Error("invalid route")
	}

	const components = route.slice(1).split("/")
	const componentValues = components.map((component) => {
		if (component.startsWith(":")) {
			const param = params[component.slice(1)]
			if (typeof param !== "string") {
				throw new Error(`missing param ${component}`)
			}

			return encodeURIComponent(param)
		} else {
			return component
		}
	})

	if (host.endsWith("/")) {
		host = host.slice(0, -1)
	}

	return `${host}/${componentValues.join("/")}`
}

export function useRoute<T extends Record<string, ModelValue> = Record<string, ModelValue>>(
	route: string,
	params: Record<string, string>
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
			throw new Error(`${applicationData.uri} has no route ${JSON.stringify(route)}`)
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
