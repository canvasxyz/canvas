import "../styles.css"

import React from "react"
import ReactDOM from "react-dom/client"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { ConnectSIWE } from "@canvas-js/hooks/components"
import { useCanvas, AuthProvider, useLiveQuery } from "@canvas-js/hooks"

import { AppContext } from "./AppContext.js"

import refs, { models } from "./refs.js"

const wsURL =
	document.location.hostname === "localhost"
		? `ws://${document.location.hostname}:8080`
		: `wss://${document.location.hostname}`

const Container: React.FC<{}> = ({}) => {
	const { app, ws, error } = useCanvas<typeof models>(wsURL, {
		signers: [new SIWESigner({ burner: true })],
		topic: "refs-example.canvas.xyz",
		contract: { models },
		reset: true,
	})

	const refs = useLiveQuery(app, "ref") ?? []

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
						<div className="bg-gray-800 rounded-lg p-6">
							<h2 className="text-xl font-semibold mb-3">Counter</h2>

							<div className="flex items-center justify-between">
								<div className="flex items-center">
									{refs.map((ref) => {
										return <div>Ref</div>
									})}
								</div>

								<div className="flex space-x-3">
									<button
										onClick={async () => {
											const item = {}
											app.actions.createRef(item)
										}}
										className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white"
									>
										Increment
									</button>
								</div>
							</div>
						</div>
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
