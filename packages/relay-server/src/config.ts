import { createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"

const { PEER_ID, LISTEN, ANNOUNCE } = process.env

export async function getPeerId() {
	if (typeof PEER_ID === "string") {
		return await createFromProtobuf(Buffer.from(PEER_ID, "base64"))
	} else {
		return await createEd25519PeerId()
	}
}

export const listen: string[] = []
if (typeof LISTEN === "string") {
	listen.push(LISTEN)
} else {
	listen.push(`/ip4/127.0.0.1/tcp/8080/ws`)
}

export const announce: string[] = []
if (typeof ANNOUNCE === "string") {
	announce.push(ANNOUNCE)
}
