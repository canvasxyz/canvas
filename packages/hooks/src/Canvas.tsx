import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

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

	const [api, setAPI] = useState<CoreAPI | null>(null)

	const getApplicationData = useCallback(async (api: CoreAPI) => {
		api
			.getApplicationData()
			.then((data) => setData(data))
			.catch((err) => setError(err))
			.finally(() => setIsLoading(false))
	}, [])

	// this handles transitions in all six possible directions
	// between the three possible types of props.host
	useEffect(() => {
		if (props.host === null) {
			if (api instanceof RemoteCoreAPI) {
				api.close()
				setAPI(null)
			}

			return
		} else if (typeof props.host === "string") {
			if (api instanceof RemoteCoreAPI) {
				if (api.host === props.host) {
					return
				}
			}

			const remoteCoreAPI = new RemoteCoreAPI(props.host)
			setAPI(remoteCoreAPI)
			return () => remoteCoreAPI.close()
		} else {
			setAPI(props.host)
		}
	}, [props.host])

	useEffect(() => {
		if (api !== null) {
			getApplicationData(api)
			const listener = () => getApplicationData(api)
			api.addEventListener("update", listener)
			api.addEventListener("connect", listener)
			api.addEventListener("disconnect", listener)
			return () => {
				api.removeEventListener("update", listener)
				api.removeEventListener("connect", listener)
				api.removeEventListener("disconnect", listener)
			}
		}
	}, [api])

	return <CanvasContext.Provider value={{ isLoading, error, api, data }}>{props.children}</CanvasContext.Provider>
}
