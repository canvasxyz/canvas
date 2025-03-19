import "../styles.css"

import React, { useState, useEffect } from "react"
import ReactDOM from "react-dom/client"

import { AuthKitProvider } from "@farcaster/auth-kit"
import { JsonRpcProvider } from "ethers"
import FrameSDK from "@farcaster/frame-sdk"

import type { SessionSigner } from "@canvas-js/interfaces"
import { SIWESigner, SIWFSigner } from "@canvas-js/chain-ethereum"
import { useCanvas, AppInfo } from "@canvas-js/hooks"

import { AppContext } from "./AppContext.js"
import { ConnectSIWE } from "./connect/ConnectSIWE.js"
import { ConnectSIWF } from "./connect/ConnectSIWF.js"
import { App } from "./App.js"

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

const Container: React.FC<{}> = ({}) => {
	const [sessionSigner, setSessionSigner] = useState<SessionSigner | null>(null)
	const [address, setAddress] = useState<string | null>(null)
	const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false)

	const { app, ws } = useCanvas(wsURL, {
		signers: [
			new SIWESigner(),
			new SIWFSigner(),
		],
	})

	useEffect(() => {
		// @ts-ignore
		FrameSDK.actions.ready()
	}, [])
	
	return (
		<AppContext.Provider value={{ address, setAddress, sessionSigner, setSessionSigner, app: app ?? null }}>
			<AuthKitProvider config={config}>
				{app && ws ? (
					<main>
						<App />
						{isInfoOpen ? (
							<div className="fixed top-12 right-5 z-10 bg-white p-4 w-[300px] border border-1 opacity-80 shadow-md rounded">
								<div className="flex justify-between items-center mb-2">
									<span className="font-medium">Connection Info</span>
									<button 
										onClick={() => setIsInfoOpen(false)}
										className="text-gray-500 hover:text-gray-700"
									>
										✕
									</button>
								</div>
								<AppInfo app={app} ws={ws} />
								<div className="sm:flex flex-row gap-4 h-full">
									<div className="flex flex-col gap-4 md:w-[480px] break-all">
										<ConnectSIWE />
										<ConnectSIWF topic={app.topic} />
										<ConnectSIWF frame={true} topic={app.topic} />
									</div>
								</div>
							</div>
						) : (
							<button
								onClick={() => setIsInfoOpen(true)}
								className="fixed top-2 right-5 z-10 bg-white p-2 rounded-full shadow-md border border-gray-200 hover:bg-gray-100"
							>
								Login
							</button>
						)}
					</main>
				) : (
					<div className="text-center my-20">Connecting to {wsURL}...</div>
				)}
			</AuthKitProvider>
		</AppContext.Provider>
	)
}

const root = ReactDOM.createRoot(document.getElementById("root")!)

root.render(
	<React.StrictMode>
		<Container />
	</React.StrictMode>,
)
