import { Canvas } from "@canvas-js/core"
import debug from "debug"
;(debug as any).useColors = () => false

const contract = await fetch("/contract.canvas.js").then((res) => res.text())

const bootstrapList = JSON.parse(localStorage.getItem("bootstrapList")!)
console.log(`using bootstrap list ${JSON.stringify(bootstrapList, null, "  ")}`)

const app = await Canvas.initialize({
	contract: contract,
	bootstrapList,
})

app.libp2p.addEventListener("connection:open", ({ detail: connection }) =>
	console.log(`opened connection to ${connection.remotePeer}`),
)

app.libp2p.addEventListener("connection:close", ({ detail: connection }) =>
	console.log(`closed connection to ${connection.remotePeer}`),
)

// app.addEventListener("message", ({ detail: { id, message } }) => {
// 	console.log("applied message", id, message)
// })

await new Promise((resolve) => setTimeout(resolve, 5 * 1000))

const peer = app.libp2p.peerId.toString()
let i = 0
while (true) {
	await new Promise((resolve) => setTimeout(resolve, Math.random() * 10000))
	await app.actions.boop({ peer, i: i++ })
}
