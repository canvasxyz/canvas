import { useState, useEffect } from "react"
import { Canvas, type CanvasConfig } from "@canvas-js/core"
import { ModelValue, QueryParams } from "@canvas-js/modeldb"

import { useLiveQuery as _useLiveQuery } from "@canvas-js/modeldb/idb"

export const useCanvas = (config: CanvasConfig) => {
	const [app, setApp] = useState<Canvas>()
	const [error, setError] = useState<Error>()

	// TODO: ensure effect hook re-runs on param changes
	useEffect(() => {
		Canvas.initialize(config)
			.then((app) => {
				setApp(app)
			})
			.catch((error) => {
				console.error(error)
				setError(error)
			})
	}, [])

	return { app, error }
}

export function useLiveQuery<T extends ModelValue = ModelValue>(
	app: Canvas | null | undefined,
	modelName: string,
	query: QueryParams = {},
) {
	return _useLiveQuery<T>(app?.db, modelName, query)
}
