import { Libp2p } from "libp2p"
import { useEffect, useState } from "react"
import { ServiceMap, getLibp2p, getPeerId } from "./libp2p"

export const useLibp2p = () => {
	const [libp2p, setLibp2p] = useState<Libp2p<ServiceMap> | null>(null)

	useEffect(() => {
		const setupLibp2p = async () => {
			const peerId = await getPeerId()
			const libp2p = await getLibp2p(peerId)
			await libp2p.start()
			setLibp2p(libp2p)
		}
		setupLibp2p()

		return () => {
			if (libp2p) libp2p.stop()
		}
	}, [])

	return { libp2p }
}
