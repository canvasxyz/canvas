import React, { useState } from "react"

import { ConnectSIWE } from "./ConnectSIWE.js"
import { ConnectATP } from "./ConnectATP.js"
import { ConnectCosmosKeplr } from "./ConnectCosmosKeplr.js"
import { ConnectTerra } from "./ConnectTerra.js"
import { ConnectCosmosEvmMetamask } from "./ConnectCosmosEvmMetamask.js"
import { ConnectEthereumKeplr } from "./ConnectEthereumKeplr.js"
import { ConnectPolkadot } from "./ConnectPolkadot.js"
import { ConnectSolana } from "./ConnectSolana.js"
import { ConnectNEAR } from "./ConnectNEAR.js"

export const Connect: React.FC<{}> = ({}) => {
	const [method, setMethod] = useState("ethereum")

	return (
		<>
			<select
				className="w-full p-2 border rounded bg-gray-100 cursor-pointer"
				value={method}
				onChange={(e) => setMethod(e.target.value)}
			>
				<option value="ethereum">Ethereum</option>
				<option value="polkadot">Polkadot</option>
				<option value="solana">Solana</option>
				<option value="cosmos-keplr">Cosmos/Keplr</option>
				<option value="ethereum-keplr">Ethereum/Keplr</option>
				<option value="near">NEAR</option>
				<option value="terra">Terra</option>
				<option value="cosmos-evm">Cosmos/EVM</option>
				<option value="bluesky">BlueSky</option>
			</select>
			<Method method={method} />
		</>
	)
}

const Method: React.FC<{ method: string }> = (props) => {
	switch (props.method) {
		case "ethereum":
			return <ConnectSIWE />
		case "polkadot":
			return <ConnectPolkadot />
		case "solana":
			return <ConnectSolana />
		case "cosmos-keplr":
			return <ConnectCosmosKeplr chainId="osmosis-1" />
		case "ethereum-keplr":
			return <ConnectEthereumKeplr chainId="evmos_9001-2" />
		case "near":
			return <ConnectNEAR contractId="something.near" network="mainnet" recipient="somebody" />
		case "terra":
			return <ConnectTerra />
		case "cosmos-evm":
			return <ConnectCosmosEvmMetamask chainId="osmosis-1" />
		case "bluesky":
			return <ConnectATP />
		default:
			throw new Error("invalid login method")
	}
}
