import { getLibp2p } from "@canvas-js/relay-server/libp2p"

const libp2p = await getLibp2p()

await libp2p.start()
