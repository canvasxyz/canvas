import { multiaddr } from "@multiformats/multiaddr"

const { BOOTSTRAP_LIST, DELAY = "0", INTERVAL = "0" } = process.env

export const delay = parseInt(DELAY) * 1000
export const interval = parseInt(INTERVAL) * 1000

export const bootstrapList = BOOTSTRAP_LIST?.split(" ") ?? []

for (const address of bootstrapList) {
	const ma = multiaddr(address)
	const peerId = ma.getPeerId()

	if (peerId === null) {
		throw new Error("Invalid bootstrap peer address: must identify peer id using /p2p")
	}
}
