import React, { useRef, useState } from "react"

import type { SessionSigner } from "@canvas-js/interfaces"
import { Eip712Signer, SIWESigner, SIWFSigner } from "@canvas-js/chain-ethereum"
import { ATPSigner } from "@canvas-js/chain-atp"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { SolanaSigner } from "@canvas-js/chain-solana"
import { SubstrateSigner } from "@canvas-js/chain-substrate"

import { useCanvas } from "@canvas-js/hooks"

import { AuthKitProvider } from "@farcaster/auth-kit"
import { JsonRpcProvider } from "ethers"
import Quill from "quill/core"

import { AppContext } from "./AppContext.js"
import { ControlPanel } from "./ControlPanel.js"
import { SessionStatus } from "./SessionStatus.js"
import { ConnectEIP712Burner } from "./connect/ConnectEIP712Burner.js"
import { ConnectionStatus } from "./ConnectionStatus.js"
import { LogStatus } from "./LogStatus.js"
import * as contract from "./contract.js"
import { Editor } from "./Editor.js"
import { useDelta } from "./useDelta.js"

export const topic = "document-example.canvas.xyz"

const wsURL = import.meta.env.VITE_CANVAS_WS_URL ?? null
console.log("websocket API URL:", wsURL)

const config = {
	// For a production app, replace this with an Optimism Mainnet
	// RPC URL from a provider like Alchemy or Infura.
	relay: "https://relay.farcaster.xyz",
	rpcUrl: "https://mainnet.optimism.io",
	domain: "document-example.canvas.xyz",
	siweUri: "https://document-example.canvas.xyz",
	provider: new JsonRpcProvider(undefined, 10),
}

export const App: React.FC<{}> = ({}) => {
	const [sessionSigner, setSessionSigner] = useState<SessionSigner | null>(null)
	const [address, setAddress] = useState<string | null>(null)

	const quillRef = useRef<Quill>()

	const topicRef = useRef(topic)

	const { app, ws } = useCanvas(wsURL, {
		topic: topicRef.current,
		contract,
		signers: [
			new SIWESigner(),
			new Eip712Signer(),
			new SIWFSigner(),
			new ATPSigner(),
			new CosmosSigner(),
			new SubstrateSigner({}),
			new SolanaSigner(),
		],
	})

	useDelta<(typeof contract)["models"]>(app, "documents", "0", (deltas) => {
		quillRef.current?.updateContents(deltas)
	})

	return (
		<AppContext.Provider value={{ address, setAddress, sessionSigner, setSessionSigner, app: app ?? null }}>
			<AuthKitProvider config={config}>
				{app && ws ? (
					<main>
						<div className="flex flex-row gap-4 h-full">
							<div
								id="quill-editor"
								className="sm:min-w-[300px] md:min-w-[480px] flex-1 flex flex-col justify-stretch gap-2"
							>
								<Editor
									ref={quillRef}
									readOnly={false}
									defaultValue={null}
									onSelectionChange={() => {}}
									onTextChange={async (delta, oldContents, source) => {
										if (source === "user") {
											await app.actions.applyDeltaToDoc(JSON.stringify(delta))
										}
									}}
								/>
							</div>
							<div className="flex flex-col gap-4 w-[480px] break-all">
								<ConnectEIP712Burner />
								<SessionStatus />
								<ConnectionStatus topic={topicRef.current} ws={ws} />
								<LogStatus />
								<ControlPanel />
							</div>
						</div>
					</main>
				) : (
					<div className="text-center my-20">Connecting to {wsURL}...</div>
				)}
			</AuthKitProvider>
		</AppContext.Provider>
	)
}
