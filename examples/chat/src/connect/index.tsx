import React, { useState } from "react"

import { ConnectSIWEBurner } from "./ConnectSIWEBurner.js"
import { ConnectSIWE } from "./ConnectSIWE.js"
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
import { ConnectNEAR } from "./ConnectNEAR.js"
import { ConnectMagic } from "./ConnectMagic.js"
import { ConnectLeap } from "./ConnectLeap.js"

export const Connect: React.FC<{}> = ({}) => {
	const [method, setMethod] = useState("burner")

	return (
		<>
			<select
				className="w-full p-2 border rounded bg-gray-100 cursor-pointer"
				value={method}
				onChange={(e) => setMethod(e.target.value)}
			>
				<option value="burner">Burner Wallet</option>
				<option value="burner-eip712">Burner Wallet - EIP712</option>
				<option value="ethereum">Ethereum</option>
				<option value="ethereum-viem">Ethereum (Viem)</option>
				<option value="ethereum-eip712">Ethereum (EIP712)</option>
				<option value="polkadot">Polkadot</option>
				<option value="solana">Solana</option>
				<option value="cosmos-keplr">Cosmos/Keplr</option>
				<option value="ethereum-keplr">Ethereum/Keplr</option>
				<option value="near">NEAR</option>
				<option value="terra">Terra</option>
				<option value="cosmos-evm">Cosmos/EVM</option>
				<option value="bluesky">BlueSky</option>
				<option value="leap">Leap</option>
				<option value="magic">Magic</option>
			</select>
			<Method method={method} />
		</>
	)
}

const Method: React.FC<{ method: string }> = (props) => {
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
		case "polkadot":
			return <ConnectPolkadot />
		case "solana":
			return <ConnectSolana />
		case "cosmos-keplr":
			return <ConnectCosmosKeplr bech32Prefix="cosmos" chainId="cosmoshub-4" />
		case "ethereum-keplr":
			return <ConnectEthereumKeplr chainId="evmos_9001-2" />
		case "near":
			return <ConnectNEAR contractId="example.near" network="mainnet" recipient="somebody" />
		case "terra":
			return <ConnectTerra />
		case "cosmos-evm":
			return <ConnectCosmosEvmMetamask chainId="cosmoshub-4" />
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
