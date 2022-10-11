#!/usr/bin/env node

import { exportToProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"

const id = await createEd25519PeerId()
process.stdout.write(Buffer.from(exportToProtobuf(id)).toString("base64"))
process.stdout.write("\n")
process.stdout.write(id.toString())
process.stdout.write("\n")
