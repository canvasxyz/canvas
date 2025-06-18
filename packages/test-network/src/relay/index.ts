import { getLibp2p } from "@canvas-js/relay-server/libp2p"

const libp2p = await getLibp2p()

await libp2p.start()

// libp2p.addEventListener("connection:open", ({ detail: { remotePeer, remoteAddr } }) => {
// 	console.log(`connection:open ${remotePeer} ${remoteAddr}`)
// })

// libp2p.addEventListener("connection:close", ({ detail: { remotePeer, remoteAddr } }) => {
// 	console.log(`connection:close ${remotePeer} ${remoteAddr}`)
// })

libp2p.services.circuitRelay.addEventListener("relay:reservation", ({ detail }) => {
	console.log("relay:reservation", detail.addr.toString())
})
