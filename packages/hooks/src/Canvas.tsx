import React, { useEffect, useMemo, useState } from "react"

import type { ApplicationData, CoreAPI } from "@canvas-js/interfaces"

import { CanvasContext } from "./CanvasContext.js"
import { RemoteCoreAPI } from "./api.js"

export interface CanvasProps {
	host: null | string | CoreAPI
	children: React.ReactNode
}

export const Canvas: React.FC<CanvasProps> = (props) => {
	const [isLoading, setIsLoading] = useState(true)
	const [data, setData] = useState<ApplicationData | null>(null)
	const [error, setError] = useState<Error | null>(null)

	const api = useMemo(() => {
		if (props.host === null) {
			return null
		} else if (typeof props.host === "string") {
			return new RemoteCoreAPI(props.host)
		} else {
			return props.host
		}
	}, [props.host])

	useEffect(() => {
		if (api === null) {
			return
		}

		api
			.getApplicationData()
			.then((data) => setData(data))
			.catch((err) => setError(err))
			.finally(() => setIsLoading(false))
	}, [api])

	return <CanvasContext.Provider value={{ isLoading, error, api, data }}>{props.children}</CanvasContext.Provider>
}
