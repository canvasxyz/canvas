import { multiaddr } from "@multiformats/multiaddr"

const { BOOTSTRAP_LIST, LISTEN, ANNOUNCE } = process.env

export const bootstrapList = BOOTSTRAP_LIST === undefined ? [] : BOOTSTRAP_LIST.split(" ")

for (const address of bootstrapList) {
	const ma = multiaddr(address)
	const peerId = ma.getPeerId()

	if (peerId === null) {
		throw new Error("Invalid bootstrap peer address: must identify peer id using /p2p")
	}
}

export const listen: string[] = []
if (typeof LISTEN === "string") {
	listen.push(LISTEN)
} else {
	listen.push(`/ip4/127.0.0.1/tcp/8080/ws`)
}

console.log("listening on", listen)

export const announce: string[] = []
if (typeof ANNOUNCE === "string") {
	announce.push(ANNOUNCE)
}

console.log("announcing on", announce)
