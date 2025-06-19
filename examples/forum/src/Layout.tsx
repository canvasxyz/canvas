import React, { useState, useContext } from "react"
import { MdOutlineSync, MdOutlineSyncProblem, MdOutlineSyncDisabled } from "react-icons/md"
import { AuthKitProvider } from "@farcaster/auth-kit"
import { JsonRpcProvider } from "ethers"

import { renderSyncStatus } from "@canvas-js/core"
import { AppInfo } from "@canvas-js/hooks"
import { useCanvas, useSIWE, useSIWF, useLogout, useSyncStatus, useClock, useRemoteClock, AuthContext } from "@canvas-js/hooks"
import { SIWESigner, SIWFSigner } from "@canvas-js/signer-ethereum"

import { App } from "./App.js"
import { AppContext } from "./AppContext.js"
import Forum from "./contract.js"

const config = {
	// For a production app, replace this with an Optimism Mainnet
	// RPC URL from a provider like Alchemy or Infura.
	relay: "https://relay.farcaster.xyz",
	rpcUrl: "https://mainnet.optimism.io",
	domain: "forum-example.canvas.xyz",
	siweUri: "https://forum-example.canvas.xyz",
	provider: new JsonRpcProvider(undefined, 10),
}

const wsURL =
	document.location.hostname === "localhost"
		? `ws://${document.location.hostname}:8080`
		: `wss://${document.location.hostname}`

const Layout: React.FC = () => {
	const { address } = useContext(AuthContext)
	const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false)

	const { app, ws } = useCanvas(wsURL, {
		signers: [new SIWESigner({ readOnly: true }), new SIWFSigner()],
		topic: "forum-example.canvas.xyz",
		contract: Forum,
		// reset: true,
	})

	const [infoOpen, setInfoOpen] = useState(false)

	const { ConnectSIWE, ConnectSIWEBurner, connectSIWEStatus, connectSIWEBurnerStatus } = useSIWE(app)
	const { ConnectSIWF, connectSIWFStatus } = useSIWF(app)
	const { Logout } = useLogout(app)
	const syncStatus = useSyncStatus(app)
	const clock = useClock(app)
	const remoteClock = useRemoteClock(app)

	return (
		<AppContext.Provider value={{ app: app ?? null }}>
			<AuthKitProvider config={config}>
				{app && ws ? (
					<main>
						<App app={app} />
						<div
							className={`${isInfoOpen ? "" : "hidden"} fixed top-4 right-5 z-10 bg-white p-4 pr-12 w-[380px] border border-1 shadow-md rounded`}
						>
							<div className="absolute top-3 right-4">
								<button onClick={() => setIsInfoOpen(false)} className="text-gray-500 hover:text-gray-700">
									✕
								</button>
							</div>
							<div className="flex flex-col break-all gap-2">
								<ConnectSIWE />
								<ConnectSIWEBurner />
								<ConnectSIWF />
								{(connectSIWEStatus === "Connected" || connectSIWEBurnerStatus === "Connected" || connectSIWFStatus === "Connected") ? <Logout /> : null}
							</div>
							<div className="block mt-4 text-gray-600 text-center text-sm">
								{app.hasSession() ? "Logged in" : "Logged out"} &middot;{" "}
								<a href="#" onClick={() => setInfoOpen(!infoOpen)}>
									Info
								</a>{" "}
								&middot; Sync {renderSyncStatus(syncStatus)} ({clock} / {remoteClock}) &middot;{" "}
								<a
									href="#"
									onClick={async () => {
										if (confirm("Reset all local data? The app will have to sync again.")) {
											localStorage.clear()
											const dbs = await window.indexedDB.databases()
											dbs.forEach((db) => {
												if (db.name === undefined) return
												window.indexedDB.deleteDatabase(db.name)
											})
											location.reload()
										}
									}}
								>
									Reset
								</a>
								{ws.error ? <span className="text-red-500 ml-1.5">Connection error</span> : ""}
							</div>
							{address ? (
								<div className="block mt-1 text-gray-600 text-center text-sm">{address.slice(0, 32)}...</div>
							) : null}
							{infoOpen && (
								<div className="block mt-4">
									<hr />
									<AppInfo app={app} ws={ws} styles={{ marginTop: "1em" }} />
								</div>
							)}
						</div>
						<button
							onClick={() => setIsInfoOpen(true)}
							className="fixed top-4 right-5 z-1 bg-white p-2 rounded-full shadow-md border border-gray-200 hover:bg-gray-100 flex"
						>
							<span className="mx-0.5">
								<div className="flex">
									{app.hasSession() ? "Account" : "Login"}{" "}
									<div className="mt-1 ml-0.5">
										{syncStatus === "offline" ? (
											<MdOutlineSyncDisabled />
										) : syncStatus === "starting" ? (
											<MdOutlineSync />
										) : syncStatus === "inProgress" ? (
											<MdOutlineSync />
										) : syncStatus === "complete" ? (
											<></>
										) : syncStatus === "error" ? (
											<MdOutlineSyncProblem />
										) : (
											<MdOutlineSyncProblem />
										)}
									</div>
								</div>
							</span>
						</button>
					</main>
				) : (
					<div className="text-center my-20 text-white">Connecting to {wsURL}...</div>
				)}
			</AuthKitProvider>
		</AppContext.Provider>
	)
}

export default Layout
