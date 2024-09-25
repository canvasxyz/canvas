import { getLibp2p } from "./libp2p.js"

const libp2p = await getLibp2p()

await libp2p.start()

libp2p.addEventListener("stop", () => {
	console.log("libp2p stopped")
})

libp2p.addEventListener("connection:open", ({ detail: { remotePeer, remoteAddr } }) => {
	console.log(`connection:open ${remotePeer} ${remoteAddr}`)
})

libp2p.addEventListener("connection:close", ({ detail: { remotePeer, remoteAddr } }) => {
	console.log(`connection:close ${remotePeer} ${remoteAddr}`)
})
