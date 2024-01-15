import { useState, useEffect, useRef } from "react"
import { Canvas, type CanvasConfig } from "@canvas-js/core"

export const useCanvas = (config: CanvasConfig) => {
	const [app, setApp] = useState<Canvas>()
	const [error, setError] = useState<Error>()
	const renderedRef = useRef(false) // skip second render in React.StrictMode

	useEffect(() => {
		if (renderedRef.current) return
		renderedRef.current = true
		Canvas.initialize(config)
			.then((app) => {
				setApp(app)
			})
			.catch((error) => {
				console.error(error)
				setError(error)
			})
	}, [])

	// TODO: ensure effect hook re-runs on all other param changes
	const signers = config.signers ?? []
	const signerKeys = signers.map((signer) => signer.key).join("+")
	useEffect(() => {
		if (!app) return
		app.updateSigners(signers)
	}, [signerKeys])

	return { app, error }
}
