// staged migrations provider

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { Canvas, TableChange, generateChangesets, ModelValue, RowChange } from "@canvas-js/core"
import { Map as ImmutableMap, List as ImmutableList } from "immutable"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"
import { useContractData } from "../hooks/useContractData.js"
import { SiweMessage } from "siwe"
import { getAddress } from "ethers"
import { useApplicationData } from "./useApplicationData.js"
import { BASE_URL } from "../utils.js"
import { ImmutableRowKey, RowKey, useChangedRows } from "./useChangedRows.js"

async function getChangesetsForContractDiff(oldContract: string, newContract: string) {
	const { build } = await Canvas.buildContract(newContract, { wasmURL: "./esbuild.wasm" })
	const app = await Canvas.initialize({
		contract: oldContract,
		topic: "test.a." + bytesToHex(randomBytes(32)),
		reset: true,
	})
	const newApp = await Canvas.initialize({
		contract: build,
		topic: "test.b." + bytesToHex(randomBytes(32)),
		reset: true,
	})
	return generateChangesets(app.getSchema(), newApp.getSchema())
}

async function timeoutWithError(ms: number, message: string): Promise<never> {
	return new Promise((resolve, reject) => {
		setTimeout(() => reject(new Error(message)), ms)
	})
}

async function getSignature(nonce: string) {
	// @ts-ignore
	if (!window.ethereum) {
		throw new Error("Ethereum provider not found. Please install a wallet like MetaMask.")
	}

	// @ts-ignore
	const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })
	const address = getAddress(accounts[0])

	// Create SIWE message
	const domain = window.location.host
	const origin = window.location.origin
	const statement = "Sign this message to confirm the contract migration."

	const siweMessage = new SiweMessage({
		domain,
		address,
		statement,
		uri: origin,
		version: "1",
		chainId: 1, // Adjust based on your network
		nonce,
	})

	const message = siweMessage.prepareMessage()

	// Request signature from wallet
	// @ts-ignore
	const signature = await window.ethereum.request({
		method: "personal_sign",
		params: [message, address],
	})
	return { address, message, signature }
}
const UNSAVED_CHANGES_KEY = "contract-editor-unsaved-changes"

const StagedMigrationsContext = createContext<{
	contractChangesets: TableChange[]
	cancelMigrations: () => Promise<void>
	clearContractChangesets: () => void
	rebuildContract: (newContract: string) => Promise<void>
	newContract: string | undefined
	runMigrations: () => void
	waitingForCommit: boolean
	commitCompleted: boolean
	hasRestoredContent: boolean
	setHasRestoredContent: (hasRestoredContent: boolean) => void
	// setWaitingForCommit: (waitingForCommit: boolean) => void
	// setCommitCompleted: (commitCompleted: boolean) => void
	changedRows: ImmutableMap<string, ImmutableMap<ImmutableRowKey, RowChange>>
	stageRowChange: (tableName: string, rowKey: RowKey, rowChange: RowChange) => void
	restoreRowChange: (tableName: string, rowKey: RowKey) => void
	clearRowChanges: () => void
	migrationIncludesSnapshot: boolean
	setMigrationIncludesSnapshot: (migrationIncludesSnapshot: boolean) => void
	newRows: ImmutableMap<string, ImmutableList<ModelValue>>
	setNewRows: (newRows: ImmutableMap<string, ImmutableList<ModelValue>>) => void
}>({
	contractChangesets: [],
	cancelMigrations: async () => {},
	clearContractChangesets: async () => {},
	rebuildContract: async () => {},
	newContract: undefined,
	runMigrations: async () => {},
	waitingForCommit: false,
	commitCompleted: false,
	hasRestoredContent: false,
	setHasRestoredContent: () => {},
	// setWaitingForCommit: () => {},
	// setCommitCompleted: () => {},
	changedRows: ImmutableMap(),
	stageRowChange: () => {},
	restoreRowChange: () => {},
	clearRowChanges: () => {},
	migrationIncludesSnapshot: false,
	setMigrationIncludesSnapshot: () => {},
	newRows: ImmutableMap(),
	setNewRows: () => {},
})

export const StagedMigrationsProvider = ({ children }: { children: React.ReactNode }) => {
	const applicationData = useApplicationData()
	const contractData = useContractData()

	const [waitingForCommit, setWaitingForCommit] = useState(false)
	const [commitCompleted, setCommitCompleted] = useState(false)
	const [migrationIncludesSnapshot, setMigrationIncludesSnapshot] = useState(false)

	const [hasRestoredContent, setHasRestoredContent] = useState(false)

	const [newRows, setNewRows] = useState<ImmutableMap<string, ImmutableList<ModelValue>>>(ImmutableMap())

	const { changedRows, stageRowChange, restoreRowChange, clearRowChanges } = useChangedRows()

	// store current saved contract here
	const [newContract, setNewContract] = useState<string>()
	const [contractChangesets, setContractChangesets] = useState<TableChange[]>([])
	const clearContractChangesets = useCallback(() => {
		setContractChangesets([])
		setNewContract(undefined)
	}, [])

	// Update migrationIncludesSnapshot when changedRows or newRows change
	useEffect(() => {
		// If there are any row changes or new rows, force migrationIncludesSnapshot to true
		if (changedRows?.size > 0 || newRows?.size > 0) {
			setMigrationIncludesSnapshot(true)
		}
	}, [changedRows, newRows])

	// when the contract, added, modified, or deleted rows change, update the changesets

	// this is called when we call "Build" after editing the contract
	const rebuildContract = useCallback(
		async (newContract: string) => {
			if (!contractData) {
				throw new Error("Contract data not found")
			}

			try {
				const changesets = await Promise.race([
					getChangesetsForContractDiff(contractData.contract, newContract),
					timeoutWithError(
						500,
						"Failed to initialize in-browser Canvas application. This is likely because " +
							"of an IndexedDB bug, try closing other windows and deleting the test.a and test.b databases.",
					),
				])
				setNewContract(newContract)
				setContractChangesets(changesets)
			} catch (err: any) {
				setNewContract(undefined)
				setContractChangesets([])

				// re-throw the error
				if (err.name === "RuntimeError" && err.message.startsWith("Aborted(TypeError: WebAssembly.instantiate()")) {
					throw new Error(
						err.message +
							" This may be because of an network explorer build issue. Try rebuilding the network explorer.",
					)
				} else if ("message" in err && typeof err.message === "string") {
					throw new Error(err.message)
				} else {
					throw new Error(err.toString())
				}
			}
		},
		[contractData],
	)

	const runMigrations = async () => {
		if (!newContract && !contractChangesets && changedRows?.size === 0 && newRows?.size === 0) {
			throw new Error("No migrations to run")
		}

		if (!contractData) {
			throw new Error("Must wait for contractData to load")
		}

		const { address, message, signature } = await getSignature(contractData.nonce)

		// Send to API with SIWE data

		const response = await fetch(`${BASE_URL}/api/migrate`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				newContract: newContract ?? contractData.contract,
				changesets: contractChangesets,
				siweMessage: message,
				address,
				signature,
				changedRows: changedRows?.toJSON() || {},
				newRows: newRows?.toJSON() || {},
				includeSnapshot: migrationIncludesSnapshot,
			}),
		})
		if (!response.ok) {
			throw new Error("Server rejected code update")
		}

		setContractChangesets([])
		clearRowChanges()
		setNewContract(undefined)
		setWaitingForCommit(true)

		// Clear saved content from localStorage once committed
		localStorage.removeItem(UNSAVED_CHANGES_KEY)
		setHasRestoredContent(false)

		// Wait till server is available again
		while (true) {
			await new Promise((resolve, reject) => setTimeout(resolve, 500))
			const available = await new Promise((resolve) =>
				fetch(`${BASE_URL}/api/contract`)
					.then(() => resolve(true))
					.catch(() => resolve(false)),
			)
			if (available) break
		}

		// Refresh both data contexts
		await Promise.all([contractData?.refetch(), applicationData?.refetch()])

		setWaitingForCommit(false)
		setCommitCompleted(true)
	}

	const cancelMigrations = useCallback(async () => {
		clearContractChangesets()
		clearRowChanges()
		setNewRows(ImmutableMap())
	}, [clearContractChangesets, clearRowChanges, setNewRows])

	return (
		<StagedMigrationsContext.Provider
			value={{
				cancelMigrations,
				clearContractChangesets,
				contractChangesets,
				rebuildContract,
				newContract,
				runMigrations,
				waitingForCommit,
				commitCompleted,
				hasRestoredContent,
				setHasRestoredContent,
				changedRows,
				stageRowChange,
				restoreRowChange,
				clearRowChanges,
				migrationIncludesSnapshot,
				setMigrationIncludesSnapshot,
				newRows,
				setNewRows,
			}}
		>
			{children}
		</StagedMigrationsContext.Provider>
	)
}

export const useStagedMigrations = () => useContext(StagedMigrationsContext)
