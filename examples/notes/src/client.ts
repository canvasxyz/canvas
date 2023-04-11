import { createClient, configureChains } from "wagmi"
import { mainnet } from "@wagmi/chains"

import { publicProvider } from "wagmi/providers/public"

import { MetaMaskConnector } from "wagmi/connectors/metaMask"
import { WalletConnectLegacyConnector } from "wagmi/connectors/walletConnectLegacy"

// Configure chains & providers with the Alchemy provider.
// Two popular providers are Alchemy (alchemy.com) and Infura (infura.io)
const { chains, provider, webSocketProvider } = configureChains([mainnet], [publicProvider()])

// Set up client
export const client = createClient({
	autoConnect: true,
	connectors: [
		new MetaMaskConnector({ chains }),
		new WalletConnectLegacyConnector({ chains, options: { qrcode: true } }),
	],
	provider,
	webSocketProvider,
})
