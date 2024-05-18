import { getLibp2p } from "./libp2p.js"

const libp2p = await getLibp2p()

libp2p.addEventListener("start", async () => {
	console.log("libp2p started")
})

libp2p.addEventListener("stop", () => {
	console.log("libp2p stopped")
})

libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer, remoteAddr } }) => {
	console.log(`connection:open ${remotePeer} ${remoteAddr}`)
})

libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer, remoteAddr } }) => {
	console.log(`connection:close ${remotePeer} ${remoteAddr}`)
})

await libp2p.start()
