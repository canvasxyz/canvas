import React, { useEffect, useState } from "react"
import { ChatView } from "./views/ChatView"
import { EnterPinView } from "./views/EnterPinView"
import { SelectWalletView } from "./views/SelectWalletView"
import { buildMagicString, constructTypedKeyBundle, signKeyBundle } from "./cryptography"
import { useAccount, useConnect } from "wagmi"
import { metamaskEncryptData, metamaskGetPublicKey } from "./cryptography"
import { extractPublicKey, getEncryptionPublicKey, personalSign } from "@metamask/eth-sig-util"
import { sha256 } from "@noble/hashes/sha256"
import { keccak256 } from "@ethersproject/keccak256"
import { UserRegistration } from "./models"
import { useStore } from "./useStore"

const getPublicKeyFromPrivateKey = (privateKey: Buffer) => {
	const data = "arbitrary data"
	const signature = personalSign({ data, privateKey })
	const publicKey = extractPublicKey({ data, signature })
	const hash = keccak256(publicKey)
	return `0x${hash.slice(-40)}`
}

const deserializeUserRegistration = (key: Uint8Array, value: Uint8Array) => {
	const address = Buffer.from(key).toString("utf-8")
	const userRegistration: UserRegistration = JSON.parse(Buffer.from(value).toString("utf-8"))
	return { address, userRegistration }
}

const serializeUserRegistration = (address: string, userRegistration: UserRegistration) => {
	// serialize and store the user registration
	const key = Buffer.from(address, "utf-8")
	const value = Buffer.from(JSON.stringify(userRegistration), "utf-8")
	return { key, value }
}

export const App: React.FC<{}> = ({}) => {
	const { connect, connectors } = useConnect()
	const { address, isConnected } = useAccount()
	const [privateKey, setPrivateKey] = useState<Buffer | null>(null)

	const [userRegistrations, setUserRegistrations] = useState<{ [key: string]: UserRegistration }>({})
	const { store: userStore } = useStore("ws://localhost:8765", async (key, value) => {
		const { address, userRegistration } = deserializeUserRegistration(key, value)
		setUserRegistrations({ ...userRegistrations, [address]: userRegistration })
	})

	useEffect(() => {
		if (privateKey !== null && address && userStore) {
			const signingAddress = getPublicKeyFromPrivateKey(privateKey)
			const encryptionPublicKey = getEncryptionPublicKey(privateKey.toString("hex"))
			const keyBundle = { signingAddress, encryptionPublicKey }

			signKeyBundle(address, keyBundle).then((signature: string) => {
				const userRegistration: UserRegistration = { signature, payload: keyBundle }
				const { key, value } = serializeUserRegistration(address, userRegistration)
				userStore.insert(key, value)
			})
		}
	}, [privateKey, userStore])

	console.log(userRegistrations)

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
