/// <reference types="vite-plugin-svgr/client" />

import React from "react"
import ReactDOM from "react-dom/client"
import { WagmiConfig } from "wagmi"

import { createConfig } from "wagmi"
import { mainnet } from "@wagmi/chains"
import { createPublicClient, http } from "viem"
import { MetaMaskConnector } from "wagmi/connectors/metaMask"
import { WalletConnectLegacyConnector } from "wagmi/connectors/walletConnectLegacy"

import "toastify-js/src/toastify.css"
import "../../styles.css"

import { App } from "./App.js"

const config = createConfig({
	autoConnect: true,
	publicClient: createPublicClient({ chain: mainnet, transport: http() }),
	connectors: [new MetaMaskConnector(), new WalletConnectLegacyConnector({ options: {} })],
})

const root = ReactDOM.createRoot(document.getElementById("root")!)

root.render(
	<React.StrictMode>
		<WagmiConfig config={config}>
			<App />
		</WagmiConfig>
	</React.StrictMode>
)
