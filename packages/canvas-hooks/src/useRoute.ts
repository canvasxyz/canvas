import { useState, useEffect, useMemo, useContext } from "react"

import type { ModelValue } from "@canvas-js/core"

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

	return `${host}/${componentValues.join("/")}`
}

export function useRoute<T extends Record<string, ModelValue> = Record<string, ModelValue>>(
	route: string,
	params: Record<string, string> = {}
): [null | Error, null | T[]] {
	const { host } = useContext(CanvasContext)
	if (host === undefined) {
		throw new Error("no host provided! you must provide a host URL in a parent Canvas element")
	}

	const [error, setError] = useState<Error | null>(null)
	const [result, setResult] = useState<T[] | null>(null)

	const url = useMemo(() => getRouteURL(host, route, params), [])

	useEffect(() => {
		const source = new EventSource(url)
		source.onmessage = (message: MessageEvent<string>) => {
			const data = JSON.parse(message.data)
			setResult(data)
			setError(null)
		}

		source.onerror = (event: Event) => {
			console.log("Subscription error:", event)
			setError(new Error("Subscription error"))
		}

		return () => {
			source.close()
		}
	}, [url])

	return [error, result]
}
