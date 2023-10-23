import { useState, useEffect } from "react"
import { ethers } from "ethers"
import { Canvas } from "@canvas-js/core"

import { WebIrys } from "@irys/sdk"
import Query from "@irys/query"
import { GossipLogEvents } from "@canvas-js/gossiplog"
import { Action, Session, CBORValue } from "@canvas-js/interfaces"

const BUNDLER_NODE = "https://node2.irys.xyz"
const GATEWAY_NODE = "https://gateway.irys.xyz"
const APP_HEADER = "App-Name-2"
const TOKEN_RPC = "https://mainnet.optimism.io"

const APP_ID = "v2-forum-demo"
const actionCache: Record<string, boolean> = {}

export function Persister({ app }: { app?: Canvas }) {
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
	}, [app?.topic])

	// set up event listeners
	useEffect(() => {
		if (!app) return

		type MessageEvent = GossipLogEvents<Action | Session, void | CBORValue>["message"]
		const handleMessage = (msg: MessageEvent) => {
			const { id, signature, message } = msg.detail
			const [_key, value] = app.messageLog.encode(signature, message)
			if (actionCache[id]) return
			put(value)
		}
		app.messageLog.addEventListener("message", handleMessage)
		return () => {
			app.messageLog.removeEventListener("message", handleMessage)
		}
	}, [app?.topic, (app?.messageLog as any)?.lockName])

	const put = async (data: Uint8Array) => {
		if (irys === undefined) {
			throw new Error("Waiting for initialization")
		}
		return new Promise<void>((resolve, reject) => {
			const dataToUpload = data
			const tags = [{ name: APP_HEADER, value: APP_ID }]
			return irys
				.upload(Buffer.from(dataToUpload), { tags })
				.then(() => resolve())
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

	const refreshAll = async (fullSync: boolean) => {
		if (!app) return

		const myQuery = new Query({ url: BUNDLER_NODE + "/graphql" })

		const seenActions: Record<string, boolean> = {}
		const expectedRoots: Record<string, boolean> = {}
		const unbundledActions: Record<string, ArrayBuffer> = {}

		const write = ({
			unbundledActions,
			orphans,
		}: {
			unbundledActions: Record<string, ArrayBuffer>
			orphans: string[]
		}) => {
			// TODO: implement rebundling
			console.log("write:", unbundledActions, orphans)
		}

		let toTimestamp = undefined
		let page = 1
		while (true) {
			const PAGE_SIZE = 20 // Can be as small as 100, irys defaults to 1000
			const MIN_BUNDLE_SIZE = 50

			const txs = await myQuery
				.search("irys:transactions")
				.tags([{ name: APP_HEADER, values: [APP_ID] }])
				.sort("DESC")
				.limit(PAGE_SIZE)
				.toTimestamp(toTimestamp)

			if (txs.length === 0) {
				if (Object.values(expectedRoots).length !== 0) {
					if (fullSync === true) {
						write({ unbundledActions, orphans: Object.keys(expectedRoots) })
					}
					console.log("orphans:", expectedRoots)
				}
				break
			}

			const txids = txs.map((tx: { id: string }) => tx.id)
			const txdatas = (
				await Promise.all(
					txids.map((txid) =>
						fetch(GATEWAY_NODE + "/" + txid)
							.then((txdata) => txdata.arrayBuffer())
							.catch((error) => {
								console.error("Error fetching individual Arweave txes:", error)
								return null
							}),
					),
				)
			).filter((txdataOrNull: ArrayBuffer | null) => txdataOrNull !== null) as ArrayBuffer[]

			let messageDecodingErrors = []
			for (const txdata of txdatas) {
				// TODO: also handle bundles here; loop over everything below for bundles:
				// for (action in isAction(item) ? [item] : item) { ... }
				try {
					const [msgid, signature, message] = app.messageLog.decode(new Uint8Array(txdata))

					// Insert the msgid into seenActionCache before calling .insert(), so we don't
					// push duplicate records to irys.
					seenActions[msgid] = true
					actionCache[msgid] = true
					delete expectedRoots[msgid]

					await app.messageLog.insert(signature, message)

					for (const parent of message.parents) {
						if (seenActions[parent]) continue
						expectedRoots[parent] = true
					}
				} catch (err) {
					messageDecodingErrors.push(err)
					continue
				}
			}
			if (messageDecodingErrors.length > 0) {
				console.warn("Error decoding individual messages:", messageDecodingErrors)
			}

			// light sync can abort, if expectedRoots is empty (unless we haven't seen any valid items yet)
			if (!fullSync && Object.values(expectedRoots).length === 0 && messageDecodingErrors.length < txdatas.length) {
				if (Object.keys(unbundledActions).length > MIN_BUNDLE_SIZE) {
					write({ unbundledActions, orphans: [] })
				}
				break
			}

			toTimestamp = Math.min(...txs.map((tx: { timestamp: number }) => tx.timestamp))
			console.log("got page", page, toTimestamp, txs.length, " txs")
			page += 1
		}
	}

	return (
		<div className="fixed z-10 top-3 left-3">
			<button className="btn btn-blue mr-2" onClick={wipe}>
				Wipe
			</button>
			<button className="btn btn-blue mr-2" onClick={() => refreshAll(true)}>
				Full Sync
			</button>
			<button className="btn btn-blue mr-2" onClick={() => refreshAll(false)}>
				Fast Sync
			</button>
		</div>
	)
}
