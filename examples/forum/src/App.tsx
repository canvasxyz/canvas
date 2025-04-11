import React, { useState } from "react"

import type { SessionSigner } from "@canvas-js/interfaces"
import { SIWESigner, SIWFSigner } from "@canvas-js/chain-ethereum"

import { useCanvas, AppInfo } from "@canvas-js/hooks"

import { AuthKitProvider } from "@farcaster/auth-kit"
import { JsonRpcProvider } from "ethers"

import { AppContext } from "./AppContext.js"
import { Messages } from "./Chat.js"
import { MessageComposer } from "./MessageComposer.js"
import { Connect } from "./connect/index.js"

const wsURL = import.meta.env.VITE_CANVAS_WS_URL ?? null
console.log("websocket API URL:", wsURL)

const config = {
	// For a production app, replace this with an Optimism Mainnet
	// RPC URL from a provider like Alchemy or Infura.
	relay: "https://relay.farcaster.xyz",
	rpcUrl: "https://mainnet.optimism.io",
	domain: "forum-example.canvas.xyz",
	siweUri: "https://forum-example.canvas.xyz",
	provider: new JsonRpcProvider(undefined, 10),
}

export const App: React.FC<{}> = ({}) => {
	const [sessionSigner, setSessionSigner] = useState<SessionSigner | null>(null)
	const [address, setAddress] = useState<string | null>(null)

	const { app, ws } = useCanvas(wsURL, {
		signers: [
			new SIWESigner(),
			new SIWFSigner(),
		],
	})

	return (
		<AppContext.Provider value={{ address, setAddress, sessionSigner, setSessionSigner, app: app ?? null }}>
			<AuthKitProvider config={config}>
				{app && ws ? (
					<main>
						<AppInfo app={app} ws={ws} />
						<div className="sm:flex flex-row gap-4 h-full">
							<div className="sm:min-w-[300px] md:min-w-[480px] flex-1 flex flex-col justify-stretch gap-2">
								<div className="flex-1 border rounded px-2 overflow-y-scroll max-h-[60vh] sm:max-h-none">
									<Messages address={address} />
								</div>
								<MessageComposer />
							</div>
							<div className="flex flex-col gap-4 md:w-[480px] break-all">
								<Connect topic={app.topic} />
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
