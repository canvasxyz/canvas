import React, { useEffect, useRef, useState } from "react"

import type { SessionSigner } from "@canvas-js/interfaces"
import { Canvas, defaultBootstrapList } from "@canvas-js/core"
import { useCanvas } from "@canvas-js/hooks"
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

	const { app } = useCanvas({
		contract,
		signers: sessionSigner ? [sessionSigner] : undefined,
		indexHistory: false,
		offline: true,
		discoveryTopic: "canvas-discovery",
		bootstrapList: [
			"/dns4/canvas-chat-discovery-p0.fly.dev/tcp/443/wss/p2p/12D3KooWG1zzEepzv5ib5Rz16Z4PXVfNRffXBGwf7wM8xoNAbJW7",
			"/dns4/canvas-chat-discovery-p1.fly.dev/tcp/443/wss/p2p/12D3KooWNfH4Z4ayppVFyTKv8BBYLLvkR1nfWkjcSTqYdS4gTueq",
			"/dns4/canvas-chat-discovery-p2.fly.dev/tcp/443/wss/p2p/12D3KooWRBdFp5T1fgjWdPSCf9cDqcCASMBgcLqjzzBvptjAfAxN",
			"/dns4/canvas-chat.fly.dev/tcp/443/wss/p2p/12D3KooWRrJCTFxZZPWDkZJboAHBCmhZ5MK1fcixDybM8GAjJM2Q",
			"/dns4/canvas-chat-2.fly.dev/tcp/443/wss/p2p/12D3KooWQW2V7moLojFaScKMza3mMqrvvQm9cEgwgyRnr271Z4tX",
			"/dns4/canvas-chat-3.fly.dev/tcp/443/wss/p2p/12D3KooWCQQz7uozb287GZCRGv7DrrZTVDuUfh2bNCd3rpUHgpes",
			...defaultBootstrapList,
		],
	})

	;(window as any).app = app

	return (
		<AppContext.Provider value={{ address, setAddress, sessionSigner, setSessionSigner, app }}>
			{app ? (
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
						<MessageComposer />
					</div>
				</main>
			) : (
				<></>
			)}
		</AppContext.Provider>
	)
}
