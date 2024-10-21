import { useState, useEffect, useRef } from "react"
import {
	Canvas,
	Contract,
	type ModelSchema,
	type Config,
	type Snapshot,
	hashContract,
	ActionImpls,
} from "@canvas-js/core"

export const useCanvas = <
	Models extends ModelSchema = ModelSchema,
	Actions extends ActionImpls<Models> = ActionImpls<Models>,
>(
	url: string | null,
	config: Config<Models, Actions>,
) => {
	const [app, setApp] = useState<Canvas<Models, Actions>>()
	const [error, setError] = useState<Error>()

	// TODO: ensure effect hook re-runs on signer change
	const hashRef = useRef<string>()
	const snapshotRef = useRef<Snapshot>()
	// const renderedRef = useRef(false) // skip second render in React.StrictMode

	useEffect(() => {
		// if (renderedRef.current) return
		// renderedRef.current = true

		const contractHash = hashContract(config.contract)

		function setupApp(appUrl: string | null, app: Canvas<Models, Actions>) {
			if (url) {
				app.connect(url).then(() => setApp(app))
			} else {
				setApp(app)
			}
		}

		async function updateSnapshot() {
			if (!app || contractHash === hashRef.current) {
				// app just initialized, or contract remains unchanged
				await Canvas.initialize<Models, Actions>(config).then(setupApp.bind(null, url))
			} else if ((await app.db.count("$messages")) > 1 && snapshotRef.current) {
				// contract changed, reuse the old snapshot
				const snapshot = snapshotRef.current
				await Canvas.initialize<Models, Actions>({ ...config, reset: true, snapshot }).then(setupApp.bind(null, url))
			} else {
				// contract changed, make a new snapshot
				const snapshot = await app.createSnapshot()
				await Canvas.initialize<Models, Actions>({ ...config, reset: true, snapshot }).then(setupApp.bind(null, url))
				snapshotRef.current = snapshot
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
