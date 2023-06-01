import { createConfig } from "@wagmi/core"
import { mainnet } from "@wagmi/chains"
import { createPublicClient, http } from "viem"

export const config = createConfig({
	autoConnect: true,
	publicClient: createPublicClient({ chain: mainnet, transport: http() }),
})
