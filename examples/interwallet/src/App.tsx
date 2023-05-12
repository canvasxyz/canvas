import React, { useEffect, useState } from "react"
import { ChatView } from "./views/ChatView"
import { EnterPinView } from "./views/EnterPinView"
import { SelectWalletView } from "./views/SelectWalletView"
import { buildMagicString } from "./cryptography"
import { useAccount, useConnect } from "wagmi"
import { metamaskEncryptData, metamaskGetPublicKey } from "./cryptography"
import { extractPublicKey, getEncryptionPublicKey, personalSign } from "@metamask/eth-sig-util"
import { sha256 } from "@noble/hashes/sha256"

const getPublicKeyFromPrivateKey = (privateKey: Buffer) => {
	const data = "arbitrary data"
	const signature = personalSign({ data, privateKey })
	return extractPublicKey({ data, signature })
}

export const App: React.FC<{}> = ({}) => {
	const { connect, connectors } = useConnect()
	const { address, isConnected } = useAccount()
	const [privateKey, setPrivateKey] = useState<Buffer | null>(null)

	useEffect(() => {
		if (privateKey !== null) {
			const signingPublicKey = getPublicKeyFromPrivateKey(privateKey)
			const encryptionPublicKey = getEncryptionPublicKey(privateKey.toString("hex"))
			const keyBundle = { signingPublicKey, encryptionPublicKey }
			// TODO: broadcast this so that other users can send us encrypted messages and identify
			// our signed messages
			console.log(keyBundle)
		}
	}, [[privateKey]])

	// if not connected to wallet, then show the select wallet view
	if (!isConnected) {
		return (
			<SelectWalletView
				selectWallet={(wallet) => {
					connect({ connector: connectors[0] })
				}}
			/>
		)
	}

	if (privateKey === null) {
		return (
			<EnterPinView
				submitPin={async (pin) => {
					const magicString = buildMagicString(pin)

					const metamaskPubKey = await metamaskGetPublicKey(address!)
					const secretSignature = metamaskEncryptData(metamaskPubKey, Buffer.from(magicString))
					setPrivateKey(Buffer.from(sha256(secretSignature)))
				}}
			/>
		)
	}

	return <ChatView privateKey={privateKey} />
}
