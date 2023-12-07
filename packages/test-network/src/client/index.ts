import { Canvas } from "@canvas-js/core"
import debug from "debug"
;(debug as any).useColors = () => false

const contract = await fetch("/contract.canvas.js").then((res) => res.text())

const bootstrapList = JSON.parse(localStorage.getItem("bootstrapList")!)

const app = await Canvas.initialize({
	contract: contract,
	bootstrapList,
})

app.addEventListener("message", ({ detail: { id, message } }) => console.log("message", id, message.payload.type))

app.libp2p.addEventListener("connection:open", ({ detail: connection }) =>
	console.log(`opened connection to ${connection.remotePeer}`),
)

app.libp2p.addEventListener("connection:close", ({ detail: connection }) =>
	console.log(`closed connection to ${connection.remotePeer}`),
)

await new Promise((resolve) => setTimeout(resolve, 5 * 1000))

for (let i = 0; i < Infinity; i++) {
	await new Promise((resolve) => setTimeout(resolve, Math.random() * 10000))
	console.log("boop")
	await app.actions.boop(i)
}
