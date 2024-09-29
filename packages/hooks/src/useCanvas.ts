import { useState, useEffect, useRef } from "react"
import { Canvas, Contract, type CanvasConfig, hashContract } from "@canvas-js/core"

export const useCanvas = <T extends Contract = Contract>(url: string | null, config: CanvasConfig<T>) => {
	const [app, setApp] = useState<Canvas<T>>()
	const [error, setError] = useState<Error>()

	// TODO: ensure effect hook re-runs on signer change
	const hashRef = useRef<string>()
	// const renderedRef = useRef(false) // skip second render in React.StrictMode

	useEffect(() => {
		// if (renderedRef.current) return
		// renderedRef.current = true

		const contractHash = hashContract(config.contract)
		if (contractHash === null) return // TODO: don't fail through if contract has dangling references

		function setupApp<T extends Contract>(newApp: Canvas<T>) {
			if (url) {
				newApp.connect(url).then(() => setApp(newApp))
			} else {
				setApp(newApp)
			}
		}

		if (!app || contractHash === hashRef.current) {
			// either the app just initialized, or the contract remains unchanged
			Canvas.initialize<T>(config)
				.then(setupApp)
				.catch((error) => {
					console.error(error)
					setError(error)
				})
		} else {
			// the contract changed, snapshot the old app
			// TODO: cache the last snapshot, and reuse it if no new actions have been applied
			app.createSnapshot().then((snapshot) => {
				Canvas.initialize<T>({ ...config, reset: true, snapshot })
					.then(setupApp)
					.catch((error) => {
						console.error(error)
						setError(error)
					})
			})
		}
		hashRef.current = contractHash
	}, [url, hashContract(config.contract)])

	return { app, error }
}
