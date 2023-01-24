import { createClient, configureChains } from "wagmi"
import { mainnet } from "wagmi/chains"

import { publicProvider } from "wagmi/providers/public"

import { MetaMaskConnector } from "wagmi/connectors/metaMask"
import { WalletConnectConnector } from "wagmi/connectors/walletConnect"

// Configure chains & providers with the Alchemy provider.
// Two popular providers are Alchemy (alchemy.com) and Infura (infura.io)
const { chains, provider, webSocketProvider } = configureChains([mainnet], [publicProvider()])

// Set up client
export const client = createClient({
	connectors: [
		new MetaMaskConnector({
			chains,
			options: {
				UNSTABLE_shimOnConnectSelectAccount: true,
			},
		}),
		new WalletConnectConnector({
			chains,
			options: {
				qrcode: true,
			},
		}),
	],
	provider,
	webSocketProvider,
})
