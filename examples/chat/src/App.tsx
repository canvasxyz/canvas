import React, { useEffect, useState } from "react"

import { Canvas } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"

import contract from "../contract.canvas.js?raw"

import { AppContext } from "./AppContext.js"
import { Connect } from "./Connect.js"
import { Messages } from "./Chat.js"
import { MessageComposer } from "./MessageComposer.js"
import { ControlPanel } from "./ControlPanel.js"
import { ConnectStatus } from "./SessionList.js"
import { location } from "./utils.js"

export const App: React.FC<{}> = ({}) => {
	const [sessionSigner, setSessionSigner] = useState<SIWESigner | null>(null)
	const [address, setAddress] = useState<string | null>(null)

	const [app, setApp] = useState<Canvas | null>(null)

	;(window as any).app = app

	useEffect(() => {
		Canvas.initialize({
			signers: [new SIWESigner({})],
			location,
			contract,
			offline: true,
			bootstrapList: [],
		}).then(setApp, (err) => console.error(err))
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
						<ConnectStatus />
						<ControlPanel />
					</div>
				</div>
			</main>
		</AppContext.Provider>
	)
}
