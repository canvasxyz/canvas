import React, { useEffect, useMemo, useRef, useState } from "react"

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

			const a = new RemoteCoreAPI(props.host)
			setAPI(a)
			a.getApplicationData()
				.then((data) => setData(data))
				.catch((err) => setError(err))
				.finally(() => setIsLoading(false))

			return () => a.close()
		} else {
			setAPI(props.host)
		}
	}, [props.host])

	return <CanvasContext.Provider value={{ isLoading, error, api, data }}>{props.children}</CanvasContext.Provider>
}
