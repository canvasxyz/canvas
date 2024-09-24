import { useState, useEffect, useRef } from "react"
import { Canvas, Contract, type CanvasConfig } from "@canvas-js/core"

export const useCanvas = <T extends Contract = Contract>(url: string | null, config: CanvasConfig<T>) => {
	const [app, setApp] = useState<Canvas<T>>()
	const [error, setError] = useState<Error>()
	const renderedRef = useRef(false) // skip second render in React.StrictMode

	useEffect(() => {
		if (renderedRef.current) return
		renderedRef.current = true

		if (!url) {
			Canvas.initialize<T>(config).then((app) => setApp(app))
			return
		}

		Canvas.initialize<T>(config)
			.then((app) => app.connect(url).then(() => setApp(app)))
			.catch((error) => {
				console.error(error)
				setError(error)
			})
	}, [url])

	// TODO: ensure effect hook re-runs on all other param changes
	const signers = config.signers ?? []
	const signerKeys = signers.map((signer) => signer.key).join("+")
	useEffect(() => {
		if (!app) return
		app.updateSigners(signers)
	}, [signerKeys])

	return { app, error }
}
