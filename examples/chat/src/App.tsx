import React, { useEffect, useRef, useState } from "react"

import type { SessionSigner } from "@canvas-js/interfaces"
import { Canvas, defaultBootstrapList } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { ATPSigner } from "@canvas-js/chain-atp"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { NEARSigner } from "@canvas-js/chain-near"
import { SubstrateSigner } from "@canvas-js/chain-substrate"
import { SolanaSigner } from "@canvas-js/chain-solana"

import { AppContext } from "./AppContext.js"
import { Messages } from "./Chat.js"
import { MessageComposer } from "./MessageComposer.js"
import { ControlPanel } from "./ControlPanel.js"
import { SessionStatus } from "./SessionStatus.js"
import { ConnectionStatus } from "./ConnectionStatus.js"
import { Connect } from "./connect/index.js"

import contract from "../contract.canvas.js?raw"

export const App: React.FC<{}> = ({}) => {
	const [sessionSigner, setSessionSigner] = useState<SessionSigner | null>(null)
	const [address, setAddress] = useState<string | null>(null)

	const [app, setApp] = useState<Canvas | null>(null)
	;(window as any).app = app

	const initRef = useRef(false)

	useEffect(() => {
		// set logging to make debugging in incognito windows easier
		localStorage.setItem("debug", "libp2p:*,canvas:*")

		if (initRef.current === false) {
			initRef.current = true
			Canvas.initialize({
				contract,
				signers: [
					new SIWESigner(),
					new ATPSigner(),
					new CosmosSigner(),
					new SubstrateSigner({}),
					new SolanaSigner(),
					new NEARSigner({}),
				],
				offline: true,
				indexHistory: false,
				bootstrapList: [
					"/dns4/canvas-chat.fly.dev/tcp/443/wss/p2p/12D3KooWRrJCTFxZZPWDkZJboAHBCmhZ5MK1fcixDybM8GAjJM2Q",
					"/dns4/canvas-chat-2.fly.dev/tcp/443/wss/p2p/12D3KooWQW2V7moLojFaScKMza3mMqrvvQm9cEgwgyRnr271Z4tX",
					"/dns4/canvas-chat-3.fly.dev/tcp/443/wss/p2p/12D3KooWCQQz7uozb287GZCRGv7DrrZTVDuUfh2bNCd3rpUHgpes",
					...defaultBootstrapList,
				],
			}).then(setApp, (err) => console.error(err))
		}
	}, [])

	return (
		<AppContext.Provider value={{ address, setAddress, sessionSigner, setSessionSigner, app, setApp }}>
			<main>
				<div className="flex flex-row gap-4 h-full">
					<div className="min-w-[480px] flex-1 flex flex-col justify-stretch gap-2">
						<div className="flex-1 border rounded px-2 overflow-y-scroll">
							<Messages address={address} />
						</div>
						<MessageComposer />
					</div>
					<div className="min-w-[480px] flex flex-col gap-4">
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
