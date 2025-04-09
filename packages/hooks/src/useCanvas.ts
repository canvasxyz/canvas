import { useState, useEffect, useRef } from "react"
import * as cbor from "@ipld/dag-cbor"
import {
	Canvas,
	NetworkClient,
	ModelSchema,
	Config,
	Snapshot,
	Actions,
	hashContract,
	hashSnapshot,
} from "@canvas-js/core"

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
	const snapshotRef = useRef<Snapshot>() // Ref for caching a local application's snapshot.
	const remoteContractHashRef = useRef<Record<string, string>>({}) // Ref for last-rendered contractHash for remote applications.
	const renderedRef = useRef(false) // Ref for skipping extra render in React.StrictMode.

	const contractHash = config && "contract" in config ? hashContract(config.contract) : null

	useEffect(() => {
		if (renderedRef.current) return
		renderedRef.current = true

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
			const httpRoot = url?.replace("ws://", "http://").replace("wss://", "https://")
			const baseApi = `${httpRoot}/api`
			const contractApi = `${httpRoot}/api/contract`
			const snapshotApi = `${httpRoot}/api/snapshot`

			async function setupRemoteApplication([info, contractInfo]: [
				{ topic: string },
				{ contract: string; snapshotHash: string },
			]) {
				if (config === undefined || "topic" in config || "contract" in config) {
					console.error("Unexpected: Internal error (remote application)")
					return
				}

				const topic = info.topic
				const contract = contractInfo.contract
				const remoteContractHash = hashContract(contractInfo.contract)

				const snapshot = contractInfo.snapshotHash
					? await (async () => {
							const response = await fetch(snapshotApi)
							const buffer = await response.arrayBuffer()
							return cbor.decode<Snapshot>(new Uint8Array(buffer))
						})()
					: null

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

				await Canvas.initialize<ModelsT, ActionsT>({
					topic,
					contract,
					reset,
					snapshot,
					...config,
				})
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
					console.error("Unexpected: Internal error (local application)")
					return
				}
				console.log("[canvas] initializing locally defined application")

				if (!app || contractHash === localContractHashRef.current) {
					// Application just initialized, or contract remains unchanged
					await Canvas.initialize<ModelsT, ActionsT>({
						...config,
						topic: config.snapshot ? `${config.topic}#${hashSnapshot(config.snapshot)}` : config.topic,
					}).then(assign.bind(null, url))
				} else if ((await app.db.count("$messages")) > 1 && snapshotRef.current) {
					// Contract changed, reuse the old snapshot
					const snapshot = snapshotRef.current
					await Canvas.initialize<ModelsT, ActionsT>({
						...config,
						reset: true,
						snapshot,
						topic: config.snapshot ? `${config.topic}#${hashSnapshot(config.snapshot)}` : config.topic,
					}).then(assign.bind(null, url))
				} else {
					// Contract changed, make a new snapshot
					const snapshot = await app.createSnapshot()
					await Canvas.initialize<ModelsT, ActionsT>({
						...config,
						reset: true,
						snapshot,
						topic: config.snapshot ? `${config.topic}#${hashSnapshot(config.snapshot)}` : config.topic,
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
