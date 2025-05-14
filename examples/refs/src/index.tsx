import "../styles.css"

import React from "react"
import ReactDOM from "react-dom/client"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { ConnectSIWE } from "@canvas-js/hooks/components"
import { useCanvas, AuthProvider } from "@canvas-js/hooks"
import { DeriveActions } from "@canvas-js/core"

import { App } from "./App.js"
import { AppContext } from "./AppContext.js"

import refs, { models } from "./refs.js"

const wsURL =
	document.location.hostname === "localhost"
		? `ws://${document.location.hostname}:8080`
		: `wss://${document.location.hostname}`

const Container: React.FC<{}> = ({}) => {
	const { app, ws, error } = useCanvas<typeof models, DeriveActions<typeof models>>(wsURL, {
		signers: [new SIWESigner({ burner: true })],
		topic: "refs-example.canvas.xyz",
		contract: { models },
		reset: true,
	})

	return (
		<AppContext.Provider value={{ app: app ?? null }}>
			<AuthProvider>
				{app && ws ? (
					<main className="max-w-lg mx-auto my-6">
						<div className="flex mb-5">
							<div className="flex-1">
								{error ? <span className="text-red-500 ml-1.5">{error.toString()}</span> : ""}
								{ws.error ? <span className="text-red-500 ml-1.5">Connection error</span> : ""}
							</div>
							<div className="p-2">
								<ConnectSIWE app={app} />
							</div>
						</div>
						<App app={app} />
					</main>
				) : (
					<div className="text-center my-20 text-white">Connecting to {wsURL}...</div>
				)}
			</AuthProvider>
		</AppContext.Provider>
	)
}

const root = ReactDOM.createRoot(document.getElementById("root")!)

root.render(
	<React.StrictMode>
		<Container />
	</React.StrictMode>,
)
