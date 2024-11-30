import React, { useRef, useState } from "react"

import type { SessionSigner } from "@canvas-js/interfaces"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { ATPSigner } from "@canvas-js/chain-atp"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { SubstrateSigner } from "@canvas-js/chain-substrate"
import { SolanaSigner } from "@canvas-js/chain-solana"

import type { Contract, Actions, ModelSchema } from "@canvas-js/core"

import { useCanvas } from "@canvas-js/hooks"

import { AppContext } from "./AppContext.js"
import { ControlPanel } from "./ControlPanel.js"
import { SessionStatus } from "./SessionStatus.js"
import { ConnectionStatus } from "./ConnectionStatus.js"
import { Connect } from "./connect/index.js"
import { LogStatus } from "./LogStatus.js"

const topic = "docs-example.canvas.xyz"

const wsURL = import.meta.env.VITE_CANVAS_WS_URL ?? null
console.log("websocket API URL:", wsURL)

export const App: React.FC<{}> = ({}) => {
	const [sessionSigner, setSessionSigner] = useState<SessionSigner | null>(null)
	const [address, setAddress] = useState<string | null>(null)

	const topicRef = useRef(topic)

	const models = {
		message: {
			id: "primary",
			address: "string",
			content: "string",
			timestamp: "integer",
			$indexes: ["address", "timestamp"],
		},
	} satisfies ModelSchema

	const actions = {
		async createMessage(db, content) {
			const { id, address, timestamp } = this
			await db.set("message", { id, address, content, timestamp })
		},
	} satisfies Actions<typeof models>

	const { app } = useCanvas(null, {
		topic: topicRef.current,
		contract: { models, actions },
		signers: [new SIWESigner(), new ATPSigner(), new CosmosSigner(), new SubstrateSigner({}), new SolanaSigner()],
	})

	return (
		<AppContext.Provider value={{ address, setAddress, sessionSigner, setSessionSigner, app: app ?? null }}>
			{app ? (
				<main>
					<div className="flex flex-row gap-4 h-full">
						<div className="min-w-[480px] flex-1 flex flex-col justify-stretch gap-2">
							TODO
							{/*
                 ...
               */}
						</div>
						<div className="flex flex-col gap-4 w-[480px] break-all">
							<Connect />
							<SessionStatus />
							<ConnectionStatus topic={topicRef.current} />
							<LogStatus />
							<ControlPanel />
						</div>
					</div>
				</main>
			) : (
				<div className="text-center my-20">Connecting to {wsURL}...</div>
			)}
		</AppContext.Provider>
	)
}
