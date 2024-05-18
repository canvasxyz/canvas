import { createEd25519PeerId } from "@libp2p/peer-id-factory"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

const query: Record<string, string> = {}

const url = new URL(window.location.href)
if (url.search.length > 1) {
	for (const entry of url.search.slice(1).split("&")) {
		const [name, value] = entry.split("=")
		query[name] = decodeURIComponent(value)
	}
}

export const bootstrapList = query.bootstrapList?.split(",") ?? []

export const relayServer: Multiaddr | null = query.relayServer ? multiaddr(query.relayServer) : null

if (relayServer !== null) {
	bootstrapList.push(relayServer.toString())
}

export const minConnections = query.minConnections ? parseInt(query.minConnections) : undefined
export const maxConnections = query.maxConnections ? parseInt(query.maxConnections) : undefined

export const listen = []
export const announce = []

export async function getPeerId() {
	return await createEd25519PeerId()
}

console.log(`bootstrap list: [ ${bootstrapList.join(", ")} ]`)

for (const address of bootstrapList) {
	const ma = multiaddr(address)
	const peerId = ma.getPeerId()

	if (peerId === null) {
		throw new Error("Invalid bootstrap peer address: must identify peer id using /p2p")
	}
}
