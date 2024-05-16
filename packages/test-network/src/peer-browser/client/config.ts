import { createEd25519PeerId } from "@libp2p/peer-id-factory"
import { multiaddr } from "@multiformats/multiaddr"

const query: Record<string, string> = {}

const url = new URL(window.location.href)
if (url.search.length > 1) {
	for (const entry of url.search.slice(1).split("&")) {
		const [name, value] = entry.split("=")
		query[name] = decodeURIComponent(value)
	}
}

// const BOOTSTRAP_LIST = window.localStorage.getItem("BOOTSTRAP_LIST")
const { cookieStore } = window as unknown as {
	cookieStore: { get: (name: string) => Promise<{ name: string; value: string } | null> }
}

export const bootstrapList = query.bootstrapList?.split(",") ?? []

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
