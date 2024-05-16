import { createEd25519PeerId } from "@libp2p/peer-id-factory"
import { multiaddr } from "@multiformats/multiaddr"

// const BOOTSTRAP_LIST = window.localStorage.getItem("BOOTSTRAP_LIST")
const { cookieStore } = window as unknown as {
	cookieStore: { get: (name: string) => Promise<{ name: string; value: string } | null> }
}

const bootstrapListCookie = await cookieStore.get("BOOTSTRAP_LIST")
const minConnectionsCookie = await cookieStore.get("MIN_CONNECTIONS")
const maxConnectionsCookie = await cookieStore.get("MAX_CONNECTIONS")

export const minConnections = minConnectionsCookie ? parseInt(minConnectionsCookie.value) : undefined
export const maxConnections = maxConnectionsCookie ? parseInt(maxConnectionsCookie.value) : undefined

export const listen = []
export const announce = []

export async function getPeerId() {
	return await createEd25519PeerId()
}

export const bootstrapList = bootstrapListCookie ? bootstrapListCookie.value.split(" ") : []

console.log(`bootstrap list: [ ${bootstrapList.join(", ")} ]`)

for (const address of bootstrapList) {
	const ma = multiaddr(address)
	const peerId = ma.getPeerId()

	if (peerId === null) {
		throw new Error("Invalid bootstrap peer address: must identify peer id using /p2p")
	}
}
