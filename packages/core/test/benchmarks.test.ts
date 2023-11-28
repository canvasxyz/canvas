import test from "ava"

import { createLibp2p } from "libp2p"
import { nanoid } from "nanoid"
import pDefer, { DeferredPromise } from "p-defer"

// import { options as bootstrapPeerOptions } from "@canvas-js/bootstrap-peer/lib/libp2p.js"

import { Canvas, Contract } from "@canvas-js/core"

import { getDirectory } from "./utils.js"

test("no-op", (t) => t.pass())

// test("test network throughput", async (t) => {
// 	// const bootstrapPeer = await createLibp2p(bootstrapPeerOptions)
// 	// await bootstrapPeer.start()

// 	// const bootstrapList = bootstrapPeer
// 	// 	.getMultiaddrs()
// 	// 	.map((addr) => addr.decapsulateCode(421).toString() + "/p2p/" + bootstrapPeer.peerId)

// 	// console.log("bootstrapList", bootstrapList)

// 	const contract = {
// 		topic: "com.example.app",
// 		models: {
// 			message: {
// 				id: "primary",
// 				address: "string",
// 				content: "string",
// 				timestamp: "integer",
// 			},
// 		},
// 		actions: {
// 			async createMessage(db, { content }, { id, address, timestamp }) {
// 				await db.set("message", { id, address, content, timestamp })
// 			},
// 		},
// 	} satisfies Contract

// 	const messageCount = 10
// 	const networkSize = 3

// 	const initialDegree = 2

// 	const nodes: {
// 		app: Canvas
// 		peerId: string
// 		listen: string
// 		bootstrapList: string[]
// 		count: number
// 		deferred: DeferredPromise<void>
// 	}[] = []

// 	for (let i = 0; i < networkSize; i++) {
// 		const bootstrapList: string[] = []
// 		const listen = `/ip4/127.0.0.1/tcp/${9000 + i}/ws`
// 		const app = await Canvas.initialize({
// 			contract,
// 			path: getDirectory(t),
// 			bootstrapList,
// 			listen: [listen],
// 		})

// 		const node = { app, peerId: app.peerId.toString(), deferred: pDefer<void>(), count: 0, bootstrapList, listen }

// 		app.libp2p?.addEventListener("connection:open", ({ detail: connection }) => {
// 			console.log(`[${app.peerId}] opened connection to ${connection.remotePeer}`)
// 		})

// 		app.addEventListener("message", ({ detail: { id, message } }) => {
// 			if (message.payload.type === "action") {
// 				node.count++
// 				console.log(`[${app.peerId}] received  ${id} (${node.count}/${messageCount})`)
// 				if (node.count === messageCount) {
// 					node.deferred.resolve()
// 					console.log("peer", app.peerId.toString(), "finished")
// 				}
// 			}
// 		})

// 		nodes.push(node)
// 	}

// 	const selectRandomPeer = (i: number) => {
// 		const index = Math.floor(Math.random() * (networkSize - 1))
// 		return index < i ? nodes[index] : nodes[index + 1]
// 	}

// 	await Promise.all(
// 		nodes.map(({ app, bootstrapList }, i) => {
// 			const peers = new Set<string>()
// 			for (let j = 0; j < initialDegree; j++) {
// 				const { peerId, listen } = selectRandomPeer(i)
// 				peers.add(`${listen}/p2p/${peerId}`)
// 			}
// 			bootstrapList.push(...peers)
// 			console.log(`[${app.peerId}] bootstrap list`, bootstrapList)
// 			return app.start()
// 		}),
// 	)

// 	await new Promise((resolve) => setTimeout(resolve, 5000))

// 	console.log("publishing messages...")
// 	for (let i = 0; i < messageCount; i++) {
// 		const { app } = nodes[Math.floor(Math.random() * nodes.length)]
// 		const { id } = await app.actions.createMessage({ content: nanoid() })
// 		console.log(`[${app.peerId}] published ${id}`)
// 	}

// 	await Promise.all(nodes.map(({ deferred }) => deferred.promise))
// })
