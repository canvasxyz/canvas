import { useState, useEffect } from "react"
import { ethers } from "ethers"
// import { encode, decode } from "microcbor"
import { Canvas } from "@canvas-js/core"

import { WebIrys } from "@irys/sdk"
import Query from "@irys/query"

const BUNDLER_NODE = "https://node2.irys.xyz"
const GATEWAY_NODE = "https://gateway.irys.xyz"
const APP_HEADER = "App-Name"
const TOKEN_RPC = "https://mainnet.optimism.io"

const APP_ID = "v2-forum-demo"

export function Persister({ app }: { app: Canvas }) {
	const [irys, setIrys] = useState<WebIrys>()

	// set up an irys instance
	useEffect(() => {
		const url = BUNDLER_NODE
		const token = "ethereum"

		// Mock a provider and signer, since we're using node2.irys.xyz which
		// doesn't charge fees for transactions <100kb.
		const provider = {
			getSigner: async () => {
				const wallet = ethers.Wallet.createRandom()
				const mock = {
					getAddress: async () => wallet.address,
					signTypedData: async (
						domain: ethers.TypedDataDomain,
						types: Record<string, ethers.TypedDataField[]>,
						value: Record<string, any>,
					) => wallet.signTypedData(domain, types, value),
				}
				return mock
			},
		}

		const wallet = { rpcUrl: TOKEN_RPC, name: "ethersv6", provider: provider }
		const webIrys = new WebIrys({ url, token, wallet })

		webIrys
			.ready()
			.then(() => {
				setIrys(webIrys)
				// refreshAll()
			})
			.catch((err) => {
				console.error(err)
				// alert("Error initializing application")
			})
	}, [])

	const put = async (data: Uint8Array) => {
		if (irys === undefined) {
			throw new Error("Waiting for initialization")
		}
		return new Promise<void>((resolve, reject) => {
			const dataToUpload = data
			const tags = [{ name: APP_HEADER, value: APP_ID }]
			return irys
				.upload(Buffer.from(dataToUpload), { tags })
				.catch((err) => {
					console.error(err)
					reject()
				})
		})
	}

	const wipe = async () => {
		const dbs = await window.indexedDB.databases()
		dbs.forEach((db) => {
			window.indexedDB.deleteDatabase(db.name as string)
		})
		location.reload()
	}

	const refreshAll = async () => {
		const myQuery = new Query({
			url: BUNDLER_NODE + "/graphql",
		})
		myQuery
			.search("irys:transactions")
			.tags([{ name: APP_HEADER, values: [APP_ID] }])
			.sort("DESC")
			.then((txs) => {
				return Promise.all(
					txs.map((tx) => fetch(GATEWAY_NODE + "/" + tx.id)
						.then((txdata) => txdata.arrayBuffer())
						.then((buffer) => {
							const [key, signature, message] = app.messageLog.decode(new Uint8Array(buffer))
							return app.messageLog.insert(signature, message)
						})
						.catch((err) => {
							console.error("invalid action on arweave:", err)
							return null
						})
				))
			})
	}

	return (
		<div className="fixed z-10 top-3 left-3">
			<button
				className="btn btn-blue mr-2"
				onClick={async () => {
					for await (const [id, signature, message] of app.messageLog.iterate()) {
						const [key, value] = app.messageLog.encode(signature, message)
						put(value)
					}
				}}
			>
				Save
			</button>
			<button
				className="btn btn-blue mr-2"
				onClick={wipe}
			>
				Wipe
			</button>
			<button className="btn btn-blue mr-2" onClick={refreshAll}>Load</button>
		</div>
	)
}
