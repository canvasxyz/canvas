import React, { useRef, useState } from "react"

import type { SessionSigner } from "@canvas-js/interfaces"
import type { Contract } from "@canvas-js/core"

import { useCanvas } from "@canvas-js/hooks"

import { AppContext } from "./AppContext.js"
import { Messages } from "./Chat.js"
import { MessageComposer } from "./MessageComposer.js"
import { ControlPanel } from "./ControlPanel.js"
import { SessionStatus } from "./SessionStatus.js"
import { ConnectionStatus } from "./ConnectionStatus.js"
import { Connect } from "./connect/index.js"

const topic = "chat-example.canvas.xyz"

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
} satisfies Contract

export const App: React.FC<{}> = ({}) => {
	const [sessionSigner, setSessionSigner] = useState<SessionSigner | null>(null)
	const [address, setAddress] = useState<string | null>(null)

	const topicRef = useRef(topic)

	const { app } = useCanvas({
		start: false,
		topic,
		contract: { ...contract, topic: topicRef.current },
		signers: sessionSigner ? [sessionSigner] : undefined,
		indexHistory: false,
	})

	return (
		<AppContext.Provider value={{ address, setAddress, sessionSigner, setSessionSigner, app: app || null }}>
			{app ? (
				<main>
					<div className="flex flex-row gap-4 h-full">
						<div className="min-w-[480px] flex-1 flex flex-col justify-stretch gap-2">
							<div className="flex-1 border rounded px-2 overflow-y-scroll">
								<Messages address={address} />
							</div>
							<MessageComposer />
						</div>
						<div className="min-w-max flex flex-col gap-4">
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
