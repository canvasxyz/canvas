import { useState, useEffect, useRef } from "react"
import { Canvas, Contract, type CanvasConfig, type Snapshot, hashContract } from "@canvas-js/core"

export const useCanvas = <T extends Contract = Contract>(url: string | null, config: CanvasConfig<T>) => {
	const [app, setApp] = useState<Canvas<T>>()
	const [error, setError] = useState<Error>()

	// TODO: ensure effect hook re-runs on signer change
	const hashRef = useRef<string>()
	const lastSnapshotRef = useRef<Snapshot>()
	// const renderedRef = useRef(false) // skip second render in React.StrictMode

	useEffect(() => {
		// if (renderedRef.current) return
		// renderedRef.current = true

		const contractHash = hashContract(config.contract)

		function setupApp<T extends Contract>(newApp: Canvas<T>) {
			if (url) {
				newApp.connect(url).then(() => setApp(newApp))
			} else {
				setApp(newApp)
			}
		}

		const updateSnapshot = async () => {
			if (!app || contractHash === hashRef.current) {
				// app just initialized, or contract remains unchanged
				await Canvas.initialize<T>(config).then(setupApp)
			} else if ((await app.db.count("$messages")) > 1 && lastSnapshotRef.current) {
				// the contract changed, reuse the old snapshot
				const snapshot = lastSnapshotRef.current
				await Canvas.initialize<T>({ ...config, reset: true, snapshot }).then(setupApp)
			} else {
				// the contract changed, make a new snapshot
				const snapshot = await app.createSnapshot()
				await Canvas.initialize<T>({ ...config, reset: true, snapshot })
					.then(setupApp)
					.then(() => {
						lastSnapshotRef.current = snapshot
					})
			}
		}
		updateSnapshot().catch((error) => {
			console.error(error)
			setError(error)
		})

		hashRef.current = contractHash
	}, [url, hashContract(config.contract)])

	return { app, error }
}
