import { useState, useEffect } from "react"
import ethers from "ethers"
import { SessionWallet, MetaMaskEthereumSessionWallet } from "@canvas-js/signers"

export const useCanvasSessionWallet = (
	ethersSigner: ethers.providers.JsonRpcSigner,
	network: ethers.providers.Network
) => {
	const [sessionWallet, setSessionWallet] = useState<SessionWallet | null>(null)

	useEffect(() => {
		if (!ethersSigner || !network) return
		const newSessionWallet = new MetaMaskEthereumSessionWallet(ethersSigner, network)
		setSessionWallet(newSessionWallet)
	}, [ethersSigner, network !== undefined])

	return sessionWallet
}
