import React, { useRef, useState } from "react"

import type { SessionSigner } from "@canvas-js/interfaces"
import { SIWESigner, SIWFSigner, Eip712Signer } from "@canvas-js/chain-ethereum"
import { ATPSigner } from "@canvas-js/chain-atp"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { SubstrateSigner } from "@canvas-js/chain-substrate"
import { SolanaSigner } from "@canvas-js/chain-solana"

import type { Contract } from "@canvas-js/core"

import { useCanvas, AppInfo } from "@canvas-js/hooks"

import { AuthKitProvider } from "@farcaster/auth-kit"
import { JsonRpcProvider } from "ethers"

import { AppContext } from "./AppContext.js"
import { Messages } from "./Chat.js"
import { MessageComposer } from "./MessageComposer.js"
import { ControlPanel } from "./ControlPanel.js"
import { SessionStatus } from "./SessionStatus.js"
import { ConnectionStatus } from "./ConnectionStatus.js"
import { Connect } from "./connect/index.js"
import { LogStatus } from "./LogStatus.js"
import * as contract from "./contract.js"

export const topic = "chat-example.canvas.xyz"

const wsURL = import.meta.env.VITE_CANVAS_WS_URL ?? null
console.log("websocket API URL:", wsURL)

const config = {
	// For a production app, replace this with an Optimism Mainnet
	// RPC URL from a provider like Alchemy or Infura.
	relay: "https://relay.farcaster.xyz",
	rpcUrl: "https://mainnet.optimism.io",
	domain: "chat-example.canvas.xyz",
	siweUri: "https://chat-example.canvas.xyz",
	provider: new JsonRpcProvider(undefined, 10),
}

export const App: React.FC<{}> = ({}) => {
	const [sessionSigner, setSessionSigner] = useState<SessionSigner | null>(null)
	const [address, setAddress] = useState<string | null>(null)

	const topicRef = useRef(topic)

	const { app, ws } = useCanvas(wsURL, {
		topic: topicRef.current,
		contract,
		signers: [
			new SIWESigner(),
			new Eip712Signer(),
			new SIWFSigner(),
			new ATPSigner(),
			new CosmosSigner(),
			new SubstrateSigner({}),
			new SolanaSigner(),
		],
	})

	return (
		<AppContext.Provider value={{ address, setAddress, sessionSigner, setSessionSigner, app: app ?? null }}>
			<AuthKitProvider config={config}>
				{app && ws ? (
					<main>
						<AppInfo app={app} ws={ws} />
						<div className="flex flex-row gap-4 h-full">
							<div className="sm:min-w-[300px] md:min-w-[480px] flex-1 flex flex-col justify-stretch gap-2">
								<div className="flex-1 border rounded px-2 overflow-y-scroll">
									<Messages address={address} />
								</div>
								<MessageComposer />
							</div>
							<div className="flex flex-col gap-4 w-[480px] break-all">
								<Connect />
								<SessionStatus />
								<ConnectionStatus topic={topicRef.current} ws={ws} />
								<LogStatus />
								<ControlPanel />
							</div>
						</div>
					</main>
				) : (
					<div className="text-center my-20">Connecting to {wsURL}...</div>
				)}
			</AuthKitProvider>
		</AppContext.Provider>
	)
}
