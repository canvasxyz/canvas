import { getLibp2p } from "@canvas-js/bootstrap-peer/libp2p"
import { createAPI } from "@canvas-js/bootstrap-peer/api"

import { Socket } from "@canvas-js/test-network/socket"

const libp2p = await getLibp2p({
	// path: string | null
	// privateKey: PrivateKey
	// listen: string[]
	// announce: string[]
	// maxConnections: number
	// maxDiscoverLimit: 2,
})

await libp2p.start()

const socket = await Socket.open(`ws://dashboard:8000`, libp2p.peerId)

socket.post("start", { topic: null })

libp2p.addEventListener("stop", () => {
	console.log("libp2p stopped")
	socket.post("stop", {})
})

libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer, remoteAddr } }) => {
	console.log(`connection:open ${remotePeer} ${remoteAddr}`)
	socket.post("connection:open", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
})

libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer, remoteAddr } }) => {
	console.log(`connection:close ${remotePeer} ${remoteAddr}`)
	socket.post("connection:close", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
})

const api = createAPI(libp2p)
api.listen(3000, () => console.log("api listening on http://localhost:3000"))
