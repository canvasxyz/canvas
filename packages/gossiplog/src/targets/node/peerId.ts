import process from "node:process"

import { createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"

export async function getPeerId() {
	const { PEER_ID } = process.env
	if (typeof PEER_ID === "string") {
		return await createFromProtobuf(Buffer.from(PEER_ID, "base64"))
	} else {
		return await createEd25519PeerId()
	}
}
