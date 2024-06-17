import { createEd25519PeerId } from "@libp2p/peer-id-factory"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

export const peerId = await createEd25519PeerId()

const query: Record<string, string> = {}

const url = new URL(window.location.href)
if (url.search.length > 1) {
	for (const entry of url.search.slice(1).split("&")) {
		const [name, value] = entry.split("=")
		query[name] = decodeURIComponent(value)
	}
}

export const bootstrapList = query.bootstrapList?.split(",") ?? []

export const listen: string[] = ["/webrtc"]
export const announce: string[] = []

export const relayServer: Multiaddr | null = query.relayServer ? multiaddr(query.relayServer) : null

if (relayServer !== null) {
	// announce.push("/webrtc")
	announce.push(`${relayServer}/p2p-circuit/webrtc/p2p/${peerId}`)
	bootstrapList.push(relayServer.toString())
}

console.log("announcing on", announce)

console.log(`bootstrap list: [ ${bootstrapList.join(", ")} ]`)

export const minConnections = query.minConnections ? parseInt(query.minConnections) : undefined
export const maxConnections = query.maxConnections ? parseInt(query.maxConnections) : undefined
