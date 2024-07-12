#!/usr/bin/env node

import { createEd25519PeerId, exportToProtobuf } from "@libp2p/peer-id-factory"

const id = await createEd25519PeerId()
console.log(`# ${id}`)
console.log(`PEER_ID=${Buffer.from(exportToProtobuf(id)).toString("base64")}`)
