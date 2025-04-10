// staged migrations provider

import { createContext, useCallback, useContext, useState } from "react"
import { Canvas, Changeset, generateChangesets } from "@canvas-js/core"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"
import { useContractData } from "../hooks/useContractData.js"

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

const StagedMigrationsContext = createContext<{
	contractChangesets: Changeset[]
	rebuildContract: (newContract: string) => Promise<void>
}>({
	contractChangesets: [],
	rebuildContract: async () => {},
})

export const StagedMigrationsProvider = ({ children }: { children: React.ReactNode }) => {
	const contractData = useContractData()

	// store current saved contract here

	// store the current added rows here

	// store the current modified rows here

	// store the current deleted rows here

	const [contractChangesets, setContractChangesets] = useState<Changeset[]>([])

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
				setContractChangesets(changesets)
			} catch (err: any) {
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

	return (
		<StagedMigrationsContext.Provider value={{ contractChangesets, rebuildContract }}>
			{children}
		</StagedMigrationsContext.Provider>
	)
}

export const useStagedMigrations = () => useContext(StagedMigrationsContext)
