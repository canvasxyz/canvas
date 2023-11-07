import React, { useEffect, useRef, useState } from "react"

import type { SessionSigner } from "@canvas-js/interfaces"
import { Canvas } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { ATPSigner } from "@canvas-js/chain-atp"

import contract from "../contract.canvas.js?raw"

import { AppContext } from "./AppContext.js"
import { ConnectSIWE } from "./ConnectSIWE.js"
import { ConnectATP } from "./ConnectATP.js"
import { Messages } from "./Chat.js"
import { MessageComposer } from "./MessageComposer.js"
import { ControlPanel } from "./ControlPanel.js"
import { SessionStatus } from "./SessionStatus.js"
import { ConnectionStatus } from "./ConnectionStatus.js"
import { ConnectCosmosKeplr } from "./ConnectCosmosKeplr.js"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { ConnectTerra } from "./ConnectTerra.js"
import { ConnectCosmosEvmMetamask } from "./ConnectCosmosEVMMetamask.js"

export const App: React.FC<{}> = ({}) => {
	const [sessionSigner, setSessionSigner] = useState<SessionSigner | null>(null)
	const [address, setAddress] = useState<string | null>(null)

	const [app, setApp] = useState<Canvas | null>(null)
	;(window as any).app = app

	const initRef = useRef(false)

	useEffect(() => {
		if (initRef.current === false) {
			initRef.current = true
			Canvas.initialize({ contract, signers: [new SIWESigner(), new ATPSigner(), new CosmosSigner()] }).then(
				setApp,
				(err) => console.error(err)
			)
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
					<div className="w-96 flex flex-col gap-4">
						<ConnectSIWE />
						<ConnectATP />
						<ConnectCosmosKeplr chainId="osmosis-1" />
						<ConnectTerra />
						<ConnectCosmosEvmMetamask chainId="osmosis-1" />
						<SessionStatus />
						<ConnectionStatus />
						<ControlPanel />
					</div>
				</div>
			</main>
		</AppContext.Provider>
	)
}
