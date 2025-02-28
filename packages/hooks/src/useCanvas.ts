import { useState, useEffect, useRef } from "react"
import { Canvas, NetworkClient, ModelSchema as Models, Config, Snapshot, Actions, hashContract } from "@canvas-js/core"

export const useCanvas = <ModelsT extends Models = Models, ActionsT extends Actions<ModelsT> = Actions<ModelsT>>(
	url: string | null,
	config: Config<ModelsT, ActionsT>,
) => {
	const [app, setApp] = useState<Canvas<ModelsT, ActionsT>>()
	const [networkClient, setNetworkClient] = useState<NetworkClient<any>>()
	const [error, setError] = useState<Error>()

	// TODO: ensure effect hook re-runs on signer change
	const hashRef = useRef<string>()
	const snapshotRef = useRef<Snapshot>()
	const renderedRef = useRef(false) // skip second render in React.StrictMode

	const contractHash = hashContract(config.contract)

	useEffect(() => {
		if (renderedRef.current) return
		renderedRef.current = true

		function setupApp(appUrl: string | null, app: Canvas<ModelsT, ActionsT>) {
			if (url) {
				app.connect(url).then((networkClient) => {
					setApp(app)
					setNetworkClient(networkClient)
				})
			} else {
				setApp(app)
			}
		}

		async function updateSnapshot() {
			if (!app || contractHash === hashRef.current) {
				// app just initialized, or contract remains unchanged
				await Canvas.initialize<ModelsT, ActionsT>(config).then(setupApp.bind(null, url))
			} else if ((await app.db.count("$messages")) > 1 && snapshotRef.current) {
				// contract changed, reuse the old snapshot
				const snapshot = snapshotRef.current
				await Canvas.initialize<ModelsT, ActionsT>({ ...config, reset: true, snapshot }).then(setupApp.bind(null, url))
			} else {
				// contract changed, make a new snapshot
				const snapshot = await app.createSnapshot()
				await Canvas.initialize<ModelsT, ActionsT>({ ...config, reset: true, snapshot }).then(setupApp.bind(null, url))
				snapshotRef.current = snapshot
			}
		}

		updateSnapshot().catch((error) => {
			console.error(error)
			setError(error)
		})

		hashRef.current = contractHash
	}, [url, contractHash])

	return { app, ws: networkClient, error }
}
