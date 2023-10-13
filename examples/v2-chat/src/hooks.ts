import { useState, useEffect } from "react"
import { Canvas, type CanvasConfig } from "@canvas-js/core"
export { useLiveQuery } from "@canvas-js/modeldb/browser"

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
				setError(error)
			})
	}, [])

	return { app, error }
}
