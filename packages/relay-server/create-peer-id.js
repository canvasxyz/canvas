#!/usr/bin/env node

import { generateKeyPair, privateKeyToProtobuf } from "@libp2p/crypto/keys"
import { peerIdFromPublicKey } from "@libp2p/peer-id"

const privateKey = await generateKeyPair("Ed25519")
const peerId = peerIdFromPublicKey(privateKey.publicKey)
console.log(`# ${peerId}`)
console.log(`LIBP2P_PRIVATE_KEY=${Buffer.from(privateKeyToProtobuf(privateKey)).toString("base64")}`)
