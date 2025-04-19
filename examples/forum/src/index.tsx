import "../styles.css"

import React, { useState, useEffect } from "react"
import ReactDOM from "react-dom/client"

import { AuthKitProvider } from "@farcaster/auth-kit"
import { JsonRpcProvider } from "ethers"
import { LuUnplug } from "react-icons/lu"

import { Canvas } from "@canvas-js/core"
import { SIWESigner, SIWFSigner } from "@canvas-js/signer-ethereum"
import { ConnectSIWE, ConnectSIWF } from "@canvas-js/hooks/components"
import { useCanvas, AppInfo, AuthProvider } from "@canvas-js/hooks"

import { App } from "./App.js"
import { AppContext } from "./AppContext.js"
import { models, actions } from "./contract.js"

const wsURL =
	document.location.hostname === "localhost"
		? `ws://${document.location.hostname}:8080`
		: `wss://${document.location.hostname}`

const config = {
	// For a production app, replace this with an Optimism Mainnet
	// RPC URL from a provider like Alchemy or Infura.
	relay: "https://relay.farcaster.xyz",
	rpcUrl: "https://mainnet.optimism.io",
	domain: "forum-example.canvas.xyz",
	siweUri: "https://forum-example.canvas.xyz",
	provider: new JsonRpcProvider(undefined, 10),
}

export const ADMIN_DID = "did:pkh:eip155:1:0x34C3A5ea06a3A67229fb21a7043243B0eB3e853f"

export type AppT = Canvas<typeof models, typeof actions>

const Container: React.FC<{}> = ({}) => {
	const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false)

	const { app, ws } = useCanvas<typeof models, typeof actions>(wsURL, {
		signers: [new SIWESigner(), new SIWFSigner()],
		topic: "forum-example.canvas.xyz",
		contract: { models, actions },
		// reset: true,
	})

	return (
		<AppContext.Provider value={{ app: app ?? null }}>
			<AuthKitProvider config={config}>
				<AuthProvider>
					{app && ws ? (
						<main>
							<App app={app} />
							<div
								className={`${isInfoOpen ? "" : "hidden"} fixed top-4 right-5 z-10 bg-white p-4 pr-12 w-[320px] border border-1 shadow-md rounded`}
							>
								<div className="absolute top-3 right-4">
									<button onClick={() => setIsInfoOpen(false)} className="text-gray-500 hover:text-gray-700">
										✕
									</button>
								</div>
								<AppInfo
									app={app}
									ws={ws}
									styles={{
										position: "absolute",
										height: "100%",
										top: 0,
										bottom: 0,
										right: 0,
									}}
									buttonStyles={{
										position: "absolute",
										right: "1rem",
										bottom: "1rem",
									}}
									popupStyles={{
										position: "absolute",
										right: "0.5rem",
										top: "0.5rem",
									}}
								/>
								<div className="flex flex-col break-all">
									<ConnectSIWE app={app} />
									<ConnectSIWF app={app} />
								</div>
								<div className="block mt-4 text-gray-600 text-center text-sm">
									{app.hasSession() ? "Logged in" : "Logged out"}
									{ws.error ? <span className="text-red-500 ml-1.5">Connection error</span> : ""}
								</div>
							</div>
							<button
								onClick={() => setIsInfoOpen(true)}
								className="fixed top-4 right-5 z-1 bg-white p-2 rounded-full shadow-md border border-gray-200 hover:bg-gray-100 flex"
							>
								<span className="mx-0.5">{app.hasSession() ? "Account" : "Login"}</span>
								{ws.error ? (
									<span className="text-red-500 mt-1 mx-0.5">
										<LuUnplug />
									</span>
								) : null}
							</button>
						</main>
					) : (
						<div className="text-center my-20 text-white">Connecting to {wsURL}...</div>
					)}
				</AuthProvider>
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
