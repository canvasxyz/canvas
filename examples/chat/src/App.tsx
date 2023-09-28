import React, { useEffect, useRef, useState } from "react"

import { Canvas } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"

import contract from "../contract.canvas.js?raw"

import { AppContext } from "./AppContext.js"
import { Connect } from "./Connect.js"
import { Messages } from "./Chat.js"
import { MessageComposer } from "./MessageComposer.js"
import { ControlPanel } from "./ControlPanel.js"
import { SessionStatus } from "./SessionStatus.js"
import { ConnectionStatus } from "./ConnectionStatus.js"
import { location } from "./utils.js"

export const App: React.FC<{}> = ({}) => {
	const [sessionSigner, setSessionSigner] = useState<SIWESigner | null>(null)
	const [address, setAddress] = useState<string | null>(null)

	const [app, setApp] = useState<Canvas | null>(null)
	;(window as any).app = app

	const initRef = useRef(false)

	useEffect(() => {
		if (initRef.current === false) {
			initRef.current = true
			Canvas.initialize({
				location,
				contract,
				// bootstrapList: [`/ip4/127.0.0.1/tcp/4444/ws/p2p/12D3KooWF6KJ8Sd2jZmNitimYXqA8y6uQQDT7ecqHRVYtuALKsX9`],
				bootstrapList: [`/ip4/127.0.0.1/tcp/8080/ws/p2p/12D3KooWKEW6KAnhn7Sr4gh9nxvwCmeTY83xrfLqTJSmgvTpauCx`],
				// bootstrapList: [
				// 	`/ip4/127.0.0.1/tcp/8080/ws/p2p/12D3KooWKEW6KAnhn7Sr4gh9nxvwCmeTY83xrfLqTJSmgvTpauCx`,
				// 	`/ip4/0.0.0.0/tcp/4444/ws/p2p/12D3KooWF6KJ8Sd2jZmNitimYXqA8y6uQQDT7ecqHRVYtuALKsX9`,
				// ],
				minConnections: 1,
			}).then(setApp, (err) => console.error(err))
		}
	}, [])

	return (
		<AppContext.Provider value={{ address, setAddress, sessionSigner, setSessionSigner, app, setApp }}>
			<main>
				<div className="flex flex-row gap-4 h-full">
					<div className="flex-1 flex flex-col justify-stretch gap-2">
						<div className="flex-1 border rounded px-2">
							<Messages />
						</div>
						<MessageComposer />
					</div>
					<div className="w-64 flex flex-col gap-4">
						<Connect />
						<SessionStatus />
						<ConnectionStatus />
						<ControlPanel />
					</div>
				</div>
			</main>
		</AppContext.Provider>
	)
}
