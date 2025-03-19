import React, { useState, useEffect } from "react"

import { ConnectSIWEBurner } from "./ConnectSIWEBurner.js"
import { ConnectSIWE } from "./ConnectSIWE.js"
import { ConnectSIWF } from "./ConnectSIWF.js"
import { ConnectSIWEViem } from "./ConnectSIWEViem.js"
import { ConnectEIP712Burner } from "./ConnectEIP712Burner.js"
import { ConnectEIP712 } from "./ConnectEIP712.js"
import { ConnectATP } from "./ConnectATP.js"
import { ConnectCosmosKeplr } from "./ConnectCosmosKeplr.js"
import { ConnectTerra } from "./ConnectTerra.js"
import { ConnectCosmosEvmMetamask } from "./ConnectCosmosEvmMetamask.js"
import { ConnectEthereumKeplr } from "./ConnectEthereumKeplr.js"
import { ConnectPolkadot } from "./ConnectPolkadot.js"
import { ConnectSolana } from "./ConnectSolana.js"
import { ConnectMagic } from "./ConnectMagic.js"
import { ConnectLeap } from "./ConnectLeap.js"

import FrameSDK from "@farcaster/frame-sdk"

export const Connect: React.FC<{ topic: string }> = ({ topic }) => {
	const [method, setMethod] = useState("burner")

	useEffect(() => {
		// @ts-ignore
		FrameSDK.actions.ready()
	}, [])

	return (
		<>
			<div className="grid gap-0.5 min-h-[100px] max-h-[15vh] sm:max-h-[50vh] overflow-y-scroll">
				<button
					className={`p-1 border rounded ${method === "burner" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
					onClick={() => setMethod("burner")}
				>
					Burner Wallet
				</button>
				<button
					className={`p-1 border rounded ${method === "burner-eip712" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
					onClick={() => setMethod("burner-eip712")}
				>
					Burner Wallet (EIP712)
				</button>
				<button
					className={`p-1 border rounded ${method === "ethereum" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
					onClick={() => setMethod("ethereum")}
				>
					Ethereum
				</button>
				<button
					className={`p-1 border rounded ${method === "ethereum-viem" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
					onClick={() => setMethod("ethereum-viem")}
				>
					Ethereum (Viem)
				</button>
				<button
					className={`p-1 border rounded ${method === "ethereum-eip712" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
					onClick={() => setMethod("ethereum-eip712")}
				>
					Ethereum (EIP712)
				</button>
				<button
					className={`p-1 border rounded ${method === "farcaster" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
					onClick={() => setMethod("farcaster")}
				>
					Sign in with Farcaster (Browser)
				</button>
				<button
					className={`p-1 border rounded ${method === "farcaster-frame" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
					onClick={() => setMethod("farcaster-frame")}
				>
					Sign in with Farcaster (Frame)
				</button>
				<button
					className={`p-1 border rounded ${method === "polkadot" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
					onClick={() => setMethod("polkadot")}
				>
					Polkadot
				</button>
				<button
					className={`p-1 border rounded ${method === "solana" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
					onClick={() => setMethod("solana")}
				>
					Solana
				</button>
				<button
					className={`p-1 border rounded ${method === "cosmos-keplr" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
					onClick={() => setMethod("cosmos-keplr")}
				>
					Cosmos (Keplr)
				</button>
				<button
					className={`p-1 border rounded ${method === "leap" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
					onClick={() => setMethod("leap")}
				>
					Cosmos (Leap)
				</button>
				<button
					className={`p-1 border rounded ${method === "ethereum-keplr" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
					onClick={() => setMethod("ethereum-keplr")}
				>
					Evmos (Keplr)
				</button>
				<button
					className={`p-1 border rounded ${method === "terra" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
					onClick={() => setMethod("terra")}
				>
					Terra
				</button>
				<button
					className={`p-1 border rounded ${method === "cosmos-evm" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
					onClick={() => setMethod("cosmos-evm")}
				>
					Cosmos (Metamask)
				</button>
				<button
					className={`p-1 border rounded ${method === "bluesky" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
					onClick={() => setMethod("bluesky")}
				>
					Bluesky
				</button>
				<button
					className={`p-1 border rounded ${method === "magic" ? "bg-blue-500 text-white" : "bg-gray-100"} ${
						!import.meta.env.VITE_PUBLIC_MAGIC_API_KEY ? "opacity-70" : ""
					}`}
					onClick={() => setMethod("magic")}
					disabled={!import.meta.env.VITE_PUBLIC_MAGIC_API_KEY}
					title={!import.meta.env.VITE_PUBLIC_MAGIC_API_KEY ? "Magic API key not configured" : undefined}
				>
					Magic {!import.meta.env.VITE_PUBLIC_MAGIC_API_KEY && "(API key required)"}
				</button>
			</div>
			<Method method={method} topic={topic} />
		</>
	)
}

const Method: React.FC<{ method: string; topic: string }> = (props) => {
	switch (props.method) {
		case "burner":
			return <ConnectSIWEBurner />
		case "burner-eip712":
			return <ConnectEIP712Burner />
		case "ethereum":
			return <ConnectSIWE />
		case "ethereum-eip712":
			return <ConnectEIP712 />
		case "ethereum-viem":
			return <ConnectSIWEViem />
		case "farcaster":
			return <ConnectSIWF topic={props.topic} />
		case "farcaster-frame":
			return <ConnectSIWF frame={true} topic={props.topic} />
		case "polkadot":
			return <ConnectPolkadot />
		case "solana":
			return <ConnectSolana />
		case "cosmos-keplr":
			return <ConnectCosmosKeplr chainId="cosmoshub-4" />
		case "ethereum-keplr":
			return <ConnectEthereumKeplr chainId="evmos_9001-2" />
		case "terra":
			return <ConnectTerra />
		case "cosmos-evm":
			return <ConnectCosmosEvmMetamask bech32Prefix="cosmos" chainId="cosmoshub-4" />
		case "bluesky":
			return <ConnectATP />
		case "leap":
			return <ConnectLeap chainId="cosmoshub-4" />
		case "magic":
			return (
				<ConnectMagic
					chainId={1}
					rpcUrl="https://eth-mainnet.g.alchemy.com/v2/fYFybLQFR9Zr2GCRcgALmAktStFKr0i0"
					publicMagicApiKey={import.meta.env.VITE_PUBLIC_MAGIC_API_KEY}
				/>
			)
		default:
			throw new Error("invalid login method")
	}
}
