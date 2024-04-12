import { libp2p } from "./libp2p.js"

libp2p.addEventListener("start", () => console.log("libp2p started"))
libp2p.addEventListener("stop", () => console.log("libp2p stopped"))

libp2p.addEventListener("connection:open", ({ detail: connection }) =>
	console.log(`connection:open ${connection.remotePeer} at ${connection.remoteAddr}`),
)

libp2p.addEventListener("connection:close", ({ detail: connection }) =>
	console.log(`connection:close ${connection.remotePeer} at ${connection.remoteAddr}`),
)

libp2p.addEventListener("peer:discovery", ({ detail: { id, multiaddrs } }) =>
	console.log(`peer:discovery ${id}`, multiaddrs),
)

libp2p.addEventListener("peer:identify", ({ detail: { peerId, protocols } }) =>
	console.log(`peer:identify ${peerId}`, protocols),
)

await libp2p.start()

process.addListener("SIGINT", () => {
	process.stdout.write("\nReceived SIGINT\n")
	libp2p.stop()
})
