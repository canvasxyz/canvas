import { useCallback, useEffect, useState } from "react"
import { KeyBundle, WalletName } from "./interfaces"
import {
	connect as connectWagmi,
	disconnect as disconnectWagmi,
	signMessage as signMessageWagmi,
	signTypedData as signTypedDataWagmi,
} from "@wagmi/core"
import { MetaMaskConnector } from "@wagmi/core/connectors/metaMask"
import { WalletConnectLegacyConnector } from "@wagmi/core/connectors/walletConnectLegacy"
import { constructTypedKeyBundle } from "./cryptography"

export const useWallet = ({
	walletName,
}: {
	walletName: WalletName | null
}): {
	userAddress: string | null
	disconnect: () => void
	signMessage: (message: string) => Promise<`0x${string}`>
	signKeyBundle: (keyBundle: KeyBundle) => Promise<`0x${string}`>
} => {
	const [userAddress, setUserAddress] = useState<string | null>(null)

	useEffect(() => {
		// connect wallet
		if (walletName === "metamask") {
			connectWagmi({ connector: new MetaMaskConnector({}) }).then((result) => {
				setUserAddress(result.account)
			})
		} else if (walletName === "walletconnect") {
			connectWagmi({ connector: new WalletConnectLegacyConnector({ options: {} }) }).then((result) => {
				setUserAddress(result.account)
			})
		} else if (walletName == null) {
			setUserAddress(null)
		} else {
			const _exhaustiveCheck: never = walletName
			throw new Error(`Unknown wallet name: ${walletName}`)
		}
	}, [walletName])

	const disconnect = useCallback(() => {
		if (walletName === "metamask" || walletName === "walletconnect") {
			// disconnect wagmi
			disconnectWagmi()
		}
	}, [walletName])

	const signMessage = useCallback(
		async (message: string) => {
			if (walletName === "metamask" || walletName === "walletconnect") {
				return signMessageWagmi({ message })
			} else if (walletName == null) {
				throw new Error("Cannot sign message: wallet not connected")
			} else {
				const _exhaustiveCheck: never = walletName
				throw new Error(`Unknown wallet name: ${walletName}`)
			}
		},
		[walletName]
	)

	const signKeyBundle = useCallback(
		async (keyBundle: KeyBundle) => {
			if (walletName === "metamask" || walletName === "walletconnect") {
				const typedKeyBundle = constructTypedKeyBundle(keyBundle)
				return signTypedDataWagmi(typedKeyBundle)
			} else if (walletName == null) {
				throw new Error("Cannot key bundle: wallet not connected")
			} else {
				const _exhaustiveCheck: never = walletName
				throw new Error(`Unknown wallet name: ${walletName}`)
			}
		},
		[walletName]
	)

	return {
		userAddress,
		disconnect,
		signMessage,
		signKeyBundle,
	}
}
