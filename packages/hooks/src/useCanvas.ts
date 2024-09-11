import { useState, useEffect, useRef } from "react"
import { Canvas, Contract, type CanvasConfig, hashContract, createSnapshot } from "@canvas-js/core"

export const useCanvas = <T extends Contract = Contract>(url: string | null, config: CanvasConfig<T>) => {
	const [app, setApp] = useState<Canvas<T>>()
	const [error, setError] = useState<Error>()

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
			createSnapshot(app, config).then((snapshot) => {
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

	// TODO: ensure effect hook re-runs on all other param changes
	const signers = config.signers ?? []
	const signerKeys = signers.map((signer) => signer.key).join("+")
	useEffect(() => {
		if (!app) return
		app.updateSigners(signers)
	}, [signerKeys])

	return { app, error }
}
