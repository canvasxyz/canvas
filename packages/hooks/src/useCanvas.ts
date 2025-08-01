import { useState, useEffect, useRef } from "react"
import * as cbor from "@ipld/dag-cbor"
import {
	Canvas,
	NetworkClient,
	ModelSchema,
	Config,
	Snapshot,
	ContractAction,
	ClientSyncStatus,
	hashContract,
} from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"

/**
 * React hook for Canvas applications using client-to-server sync.
 *
 * @param url The wss:// endpoint to connect to.
 * @param config The application to run inside the hook. If `topic` and
 * `contract` are empty, this will fetch the application contract from
 * `url`, and live-update the local app when the server contract changes.
 */
export const useCanvas = <
	ModelsT extends ModelSchema = ModelSchema,
	InstanceT extends Contract<ModelsT> = Contract<ModelsT> & Record<string, ContractAction<ModelsT>>,
>(
	url: string | null,
	config?: Config<ModelsT, InstanceT>,
) => {
	const [app, setApp] = useState<Canvas<ModelsT, InstanceT>>()
	const [networkClient, setNetworkClient] = useState<NetworkClient<any>>()
	const [error, setError] = useState<Error>()

	const localContractHashRef = useRef<string>() // Ref for last-rendered contractHash of a local application.
	const snapshotRef = useRef<Snapshot>() // Ref for caching a local application's snapshot.
	const remoteContractHashRef = useRef<Record<string, string>>({}) // Ref for last-rendered contractHash for remote applications.
	const renderedRef = useRef(false) // Ref for skipping extra render in React.StrictMode.

	const contractHash = config && typeof config.contract === "string" ? hashContract(config.contract) : null

	// useEffect(() => {
	// 	// keep app signers updated
	// 	if (!app || !config || config.signers === undefined) return
	// 	app.updateSigners(config.signers)
	// 	console.warn(config.signers?.map(s => s.key), "signers updated")
	// }, [config.signers?.map(s => s.key)])

	useEffect(() => {
		if (renderedRef.current) return
		renderedRef.current = true

		function assign(appUrl: string | null, app: Canvas<ModelsT, InstanceT>) {
			if (url) {
				app
					.connect(url)
					.then((networkClient) => {
						setApp(app)
						setNetworkClient(networkClient)
					})
					.catch((err) => {
						console.error(err)
						setApp(app)
						setTimeout(() => assign(appUrl, app), 2000)
					})
			} else {
				setApp(app)
			}
		}

		if (contractHash === null) {
			// Set up a remotely fetched application.
			const httpRoot = url?.replace("ws://", "http://").replace("wss://", "https://")
			const baseApi = `${httpRoot}/api`
			const contractApi = `${httpRoot}/api/contract`
			const snapshotApi = `${httpRoot}/api/snapshot`

			async function setupRemoteApplication([info, contractInfo]: [{ topic: string }, { contract: string }]) {
				if (config === undefined) {
					console.error("Canvas WebSocket remote did not return a valid application topic or contract")
					return
				}

				const topic = info.topic
				const contract = contractInfo.contract
				const remoteContractHash = hashContract(contractInfo.contract)

				// TODO: only request this if we know there's a snapshot...
				const snapshot = await (async () => {
					try {
						const response = await fetch(snapshotApi)
						const buffer = await response.arrayBuffer()
						return cbor.decode<Snapshot>(new Uint8Array(buffer))
					} catch (err) {
						return null
					}
				})()

				let reset: boolean
				if (remoteContractHashRef.current[topic] === undefined) {
					// No matching contract used with this hook, but it's possible that we've run this
					// app without this hook before, and have data in IndexedDB, in which case
					// convergence might break.
					reset = false // TODO
				} else if (remoteContractHashRef.current[topic] === contractInfo.contract) {
					// A matching contract used with this hook before. We can't guarantee that IndexedDB
					// isn't out of sync, but that's beyond our concern (something to fix in the future).
					reset = false
				} else {
					// A different contract was used with this hook. Always reset IndexedDB.
					reset = true
				}

				console.log("[canvas] initializing remote application")

				await Canvas.initialize<ModelsT, InstanceT>({ reset, snapshot, ...config })
					.then(assign.bind(null, url))
					.finally(() => {
						remoteContractHashRef.current[topic] = remoteContractHash
					})
			}

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
					console.error("Canvas application initialized without both a topic and contract")
					return
				}
				console.log("[canvas] initializing locally defined application")

				if (!app || contractHash === localContractHashRef.current) {
					// Application just initialized, or contract remains unchanged
					await Canvas.initialize({
						...config,
						topicOverride: config.topicOverride,
					}).then(assign.bind(null, url))
				} else if ((await app.db.count("$messages")) > 1 && snapshotRef.current) {
					// Contract changed, reuse the old snapshot
					const snapshot = snapshotRef.current
					await Canvas.initialize({
						...config,
						reset: true,
						snapshot,
						topicOverride: config.topicOverride,
					}).then(assign.bind(null, url))
				} else {
					// Contract changed, make a new snapshot
					const snapshot = await app.createSnapshot()
					await Canvas.initialize({
						...config,
						reset: true,
						snapshot,
						topicOverride: config.topicOverride,
					}).then(assign.bind(null, url))
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
