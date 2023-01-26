// import { useState, useEffect } from "react"
// import { ethers } from "ethers"
// import { SessionSigner, MetaMaskEthereumSigner } from "@canvas-js/signers"

// export const useCanvasSigner = (ethersSigner: ethers.providers.JsonRpcSigner, network?: ethers.providers.Network) => {
// 	const [signer, setSigner] = useState<SessionSigner | null>(null)

// 	useEffect(() => {
// 		const newSigner = !ethersSigner || !network ? null : new MetaMaskEthereumSigner(ethersSigner, network)
// 		setSigner(newSigner)
// 	}, [ethersSigner, network !== undefined])

// 	return signer
// }
