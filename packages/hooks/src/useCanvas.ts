import { useState, useEffect, useRef } from "react"
import { Canvas, NetworkClient, ModelSchema, Config, Snapshot, Actions, hashContract } from "@canvas-js/core"

/**
 * React hook for Canvas applications, using client-to-server sync.
 *
 * @param url The wss:// endpoint to connect to.
 * @param config The application to run inside the hook. If `topic` and `contract` are left empty, this will fetch the application from the URL, and the local application will live-update when the server side application is changed.
 * @returns
 */
export const useCanvas = <
	ModelsT extends ModelSchema = ModelSchema,
	ActionsT extends Actions<ModelsT> = Actions<ModelsT>,
>(
	url: string | null,
	config: Config<ModelsT, ActionsT> | Omit<Config<ModelsT, ActionsT>, "topic" | "contract">,
) => {
	const [app, setApp] = useState<Canvas<ModelsT, ActionsT>>()
	const [networkClient, setNetworkClient] = useState<NetworkClient<any>>()
	const [error, setError] = useState<Error>()

	// TODO: Ensure effect hook re-runs when signers are changed.
	const localContractHashRef = useRef<string>() // Ref for last-rendered contractHash of a local application.
	const remoteContractHashRef = useRef<Record<string, string>>({}) // Ref for last-rendered contractHash for remote applications.
	const snapshotRef = useRef<Snapshot>() // Ref for caching a local application's snapshot.
	const renderedRef = useRef(false) // Ref for skipping extra render in React.StrictMode.

	const contractHash = config && "contract" in config ? hashContract(config.contract) : null

	useEffect(() => {
		if (renderedRef.current) return
		renderedRef.current = true

		// Assign a new application to the hook's state vars.
		function assign(appUrl: string | null, app: Canvas<ModelsT, ActionsT>) {
			if (url) {
				app
					.connect(url)
					.then((networkClient) => {
						setApp(app)
						setNetworkClient(networkClient)
					})
					.catch((err) => {
						setApp(app)
						setTimeout(() => assign(appUrl, app), 2000)
					})
			} else {
				setApp(app)
			}
		}

		if (contractHash === null) {
			// Set up a remotely fetched application.
			async function setupRemoteApplication([info, contractInfo]: [{ topic: string }, { contract: string }]) {
				if (config === undefined || "topic" in config || "contract" in config) {
					console.error("Unexpected: Internal error (remote application)")
					return
				}

				const topic = info.topic
				const contract = contractInfo.contract
				const remoteContractHash = hashContract(contractInfo.contract)
				let reset: boolean

				// TODO: Maybe the contract is already in IndexedDB?
				// We should store the contract in ModelDB, and/or always include contractHash in the topic.
				if (remoteContractHashRef.current[topic] === undefined) {
					reset = false
				} else if (contractInfo.contract === remoteContractHashRef.current[topic]) {
					reset = false
				} else {
					reset = true
				}

				// TODO: Add a remote snapshot.
				await Canvas.initialize<ModelsT, ActionsT>({
					topic,
					contract,
					reset,
					...config,
				})
					.then(assign.bind(null, url))
					.finally(() => {
						remoteContractHashRef.current[topic] = remoteContractHash
					})
			}

			const httpRoot = url?.replace("ws://", "http://").replace("wss://", "https://")
			const baseApi = `${httpRoot}/api`
			const contractApi = `${httpRoot}/api/contract`

			Promise.all([
				fetch(baseApi).then((response) => response.json()),
				fetch(contractApi).then((response) => response.json()),
			])
				.then(setupRemoteApplication)
				.catch((error) => {
					console.error(error)
					setError(error)
				})
		} else {
			// Set up the application from a local `config`.
			// Snapshot, reset, and restart the application from a snapshot if the contract changed.
			async function setupLocalApplicationBySnapshot() {
				if (config === undefined || !("topic" in config) || !("contract" in config)) {
					console.error("Unexpected: Internal error (local application)")
					return
				}
				if (!app || contractHash === localContractHashRef.current) {
					// Application just initialized, or contract remains unchanged
					await Canvas.initialize<ModelsT, ActionsT>(config).then(assign.bind(null, url))
				} else if ((await app.db.count("$messages")) > 1 && snapshotRef.current) {
					// Contract changed, reuse the old snapshot
					const snapshot = snapshotRef.current
					await Canvas.initialize<ModelsT, ActionsT>({ ...config, reset: true, snapshot }).then(assign.bind(null, url))
				} else {
					// Contract changed, make a new snapshot
					const snapshot = await app.createSnapshot()
					await Canvas.initialize<ModelsT, ActionsT>({ ...config, reset: true, snapshot }).then(assign.bind(null, url))
					snapshotRef.current = snapshot
				}
			}

			setupLocalApplicationBySnapshot().catch((error) => {
				console.error(error)
				setError(error)
			})

			localContractHashRef.current = contractHash
		}
	}, [url, contractHash])

	return { app, ws: networkClient, error }
}
