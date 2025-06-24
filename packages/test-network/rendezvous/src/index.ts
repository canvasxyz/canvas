import { getLibp2p } from "@canvas-js/bootstrap-peer/libp2p"
import { createAPI } from "@canvas-js/bootstrap-peer/api"

import { PeerSocket } from "@canvas-js/test-network/socket-peer"

const { PORT = "3000", DASHBOARD_URL = "ws://dashboard:8000" } = process.env

const libp2p = await getLibp2p({})

await libp2p.start()

const socket = await PeerSocket.open(DASHBOARD_URL, libp2p.peerId)

socket.post("start", { workerId: null, topic: null, root: null, clock: null, heads: null })

libp2p.addEventListener("stop", () => {
	console.log("libp2p stopped")
})

libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer, remoteAddr } }) => {
	// console.log(`connection:open ${remotePeer} ${remoteAddr}`)
	socket.post("connection:open", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
})

libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer, remoteAddr } }) => {
	// console.log(`connection:close ${remotePeer} ${remoteAddr}`)
	socket.post("connection:close", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
})

const api = createAPI(libp2p)
api.listen(parseInt(PORT), () => console.log(`api listening on http://localhost:${PORT}`))
