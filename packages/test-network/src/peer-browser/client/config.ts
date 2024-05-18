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

export const listen: string[] = []
export const announce: string[] = []

export const relayServer: Multiaddr | null = query.relayServer ? multiaddr(query.relayServer) : null

if (relayServer !== null) {
	bootstrapList.push(relayServer.toString())
	listen.push(`${relayServer}/p2p-circuit/p2p/${peerId}`)
	announce.push(`${relayServer}/p2p-circuit/p2p/${peerId}`)
}

console.log(`bootstrap list: [ ${bootstrapList.join(", ")} ]`)

export const minConnections = query.minConnections ? parseInt(query.minConnections) : bootstrapList.length
export const maxConnections = query.maxConnections ? parseInt(query.maxConnections) : undefined
