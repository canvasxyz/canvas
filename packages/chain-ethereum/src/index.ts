import { ethers } from "ethers"
import type { TypedDataSigner, Signer } from "@ethersproject/abstract-signer"
import type { ChainImplementation } from "@canvas-js/interfaces"

import { verifyAction, verifySession } from "./verifier.js"
import { signAction, signSession } from "./signers.js"

const ethereumChainImplementation: ChainImplementation<TypedDataSigner & Signer, ethers.Wallet> = {
	match: (chain, chainId) => chain === "ethereum",
	verifyAction,
	verifySession,
	signSession,
	signAction: (signer, payload) => signAction(signer, payload, null),
	signDelegatedAction: (signer, payload) => signAction(signer, payload, signer.address),
	importDelegatedSigner: (session, privateKey) => new ethers.Wallet(privateKey),
	exportDelegatedSigner: (session, signer) => signer.privateKey,
	generateDelegatedSigner: async () => {
		const wallet = ethers.Wallet.createRandom()
		return [wallet.address, wallet]
	},
}

export default ethereumChainImplementation
