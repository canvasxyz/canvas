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

export const contract = {
	models: {
		message: {
			id: "primary",
			address: "string",
			content: "string",
			timestamp: "integer",
			$indexes: ["address", "timestamp"],
		},
	},
	actions: {
		async createMessage(db, { content }, { id, address, timestamp }) {
			console.log("received message:", content)
			await db.set("message", { id, address, content, timestamp })
		},
	},
}

export const App: React.FC<{}> = ({}) => {
	const [sessionSigner, setSessionSigner] = useState<SessionSigner | null>(null)
	const [address, setAddress] = useState<string | null>(null)

	const topicRef = useRef("chat-example.canvas.xyz")

	const { app } = useCanvas({
		contract: { ...contract, topic: topicRef.current },
		signers: sessionSigner ? [sessionSigner] : undefined,
		indexHistory: false,
		discoveryTopic: "canvas-discovery",
		trackAllPeers: true,
		presenceTimeout: 12 * 60 * 60 * 1000, // keep up to 12 hours of offline peers
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
							<ConnectionStatus topic={topicRef.current} />
							<ControlPanel />
						</div>
					</div>
				</main>
			) : (
				<></>
			)}
		</AppContext.Provider>
	)
}
