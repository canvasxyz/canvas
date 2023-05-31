import { createConfig } from "wagmi"
import { mainnet } from "@wagmi/chains"
import { createPublicClient, http } from "viem"
import { MetaMaskConnector } from "wagmi/connectors/metaMask"
import { WalletConnectLegacyConnector } from "wagmi/connectors/walletConnectLegacy"

export const config = createConfig({
	autoConnect: true,
	publicClient: createPublicClient({ chain: mainnet, transport: http() }),
	connectors: [new MetaMaskConnector(), new WalletConnectLegacyConnector({ options: {} })],
})
