import React, { useRef, useState } from "react"

import type { SessionSigner } from "@canvas-js/interfaces"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { ATPSigner } from "@canvas-js/chain-atp"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { SubstrateSigner } from "@canvas-js/chain-substrate"
import { SolanaSigner } from "@canvas-js/chain-solana"

import type { Actions, ModelSchema, DeriveModelType } from "@canvas-js/core"

import { useCanvas, useLiveQuery } from "@canvas-js/hooks"

import { AppContext } from "./AppContext.js"
import { ControlPanel } from "./ControlPanel.js"
import { SessionStatus } from "./SessionStatus.js"
import { ConnectionStatus } from "./ConnectionStatus.js"
import { Connect } from "./connect/index.js"
import { LogStatus } from "./LogStatus.js"

const topic = "docs-example.canvas.xyz"

const ACTIVE_DOC_KEY = "canvas-docs-active-doc"

const wsURL = import.meta.env.VITE_CANVAS_WS_URL ?? null
console.log("websocket API URL:", wsURL)

export const App: React.FC<{}> = ({}) => {
	const [sessionSigner, setSessionSigner] = useState<SessionSigner | null>(null)
	const [address, setAddress] = useState<string | null>(null)

	const [activeDoc, setActiveDoc] = useState<string | null>(() => {
		return localStorage.getItem(ACTIVE_DOC_KEY)
	})

	React.useEffect(() => {
		if (activeDoc) {
			localStorage.setItem(ACTIVE_DOC_KEY, activeDoc)
		} else {
			localStorage.removeItem(ACTIVE_DOC_KEY)
		}
	}, [activeDoc])

	const topicRef = useRef(topic)

	const models = {
		documents: {
			id: "primary",
			content: "string",
			creator: "string", // immutable
			$indexes: ["creator"],
		},
	} satisfies ModelSchema

	const actions = {
		async createDocument(db) {
			await db.set("documents", { id: this.id, content: "", creator: this.did })
		},
		async updateDocument(db, id: string, content: string) {
			await db.update("documents", { id, content })
		},
	} satisfies Actions<typeof models>

	const { app } = useCanvas(null, {
		topic: topicRef.current,
		contract: { models, actions },
		signers: [new SIWESigner(), new ATPSigner(), new CosmosSigner(), new SubstrateSigner({}), new SolanaSigner()],
	})

	const documents = useLiveQuery<DeriveModelType<typeof models.documents>>(app, "documents")

	return (
		<AppContext.Provider value={{ address, setAddress, sessionSigner, setSessionSigner, app: app ?? null }}>
			{app ? (
				<main>
					<div className="flex flex-row gap-4 h-full">
						<div className="min-w-[180px] flex-0 flex flex-col gap-2">
							<div className="w-full border rounded cursor-pointer py-3">
								{documents?.map((doc) => (
									<div
										key={doc.id}
										className={`py-1 px-4 hover:bg-gray-100 transition-colors cursor-pointer ${activeDoc === doc.id ? "bg-gray-100" : ""}`}
										onClick={() => {
											setActiveDoc(doc.id)
										}}
									>
										{doc.id.slice(0, 12)}...
									</div>
								))}
								<div
									className="py-1 px-4 hover:bg-gray-100 transition-colors cursor-pointer"
									onClick={async (event) => {
										if (!app) return
										const { id } = await app.actions.createDocument()
										setActiveDoc(id)
									}}
								>
									New Document
								</div>
							</div>
						</div>
						<div className="min-w-[300px] flex-1 flex flex-col justify-stretch gap-2">
							{activeDoc && (
								<div className="w-full p-[1px] border rounded">
									<textarea
										rows={20}
										className="w-full h-full outline-none box-shadow-none"
										value={documents?.find((doc) => doc.id === activeDoc)?.content ?? ""}
										onChange={async (event) => {
											if (!app) return
											if (!activeDoc) return
											await app.actions.updateDocument(activeDoc, event.target.value)
										}}
									></textarea>
								</div>
							)}
						</div>
						<div className="flex flex-col gap-4 w-[320px] break-all">
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
