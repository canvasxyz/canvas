import { PeerId } from "@libp2p/interface"
import { createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"
import { multiaddr } from "@multiformats/multiaddr"

const { PEER_ID, BOOTSTRAP_LIST, LISTEN, ANNOUNCE } = process.env

async function getPeerId() {
	if (typeof PEER_ID === "string") {
		return await createFromProtobuf(Buffer.from(PEER_ID, "base64"))
	} else {
		return await createEd25519PeerId()
	}
}

export const peerId: PeerId = await getPeerId()

console.log("using peer id", peerId.toString())

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