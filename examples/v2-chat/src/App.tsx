import { useState, useRef, type FormEvent } from "react"
import "./App.css"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { ethers } from "ethers"
import { useCanvas, useLiveQuery } from "./hooks.js"
import { PublicChat } from "./contract.js"

function App() {
	const wallet = ethers.Wallet.createRandom()
	const { app } = useCanvas({
		contract: { ...PublicChat, topic: "my-demo-app" },
		signers: [new SIWESigner({ signer: wallet })],
		location: "sqldb",
	})

	const inputRef = useRef<HTMLInputElement>(null)
	const [page, setPage] = useState(0)
	const [sending, setSending] = useState(false)

	const messages = useLiveQuery(app?.db ?? null, "messages", {
		limit: 10,
		offset: page * 10,
		orderBy: { timestamp: "desc" },
	})

	const send = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (sending || app === undefined || inputRef.current === null) return
		setSending(true)
		app.actions
			.sendMessage({ message: inputRef.current.value })
			.then(() => {
				if (inputRef.current) inputRef.current.value = ""
			})
			.finally(() => {
				setSending(false)
			})
	}

	return (
		<div>
			<form onSubmit={send}>
				<input type="text" ref={inputRef} placeholder="Send message..." autoFocus />
				<button type="submit">Send</button>
			</form>
			<div>
				{messages?.map((message) => (
					<div key={message.timestamp as any}>
						{message.from}: {message.message}
					</div>
				))}
				Page: {page + 1}
				<button onClick={() => setPage(Math.max(0, page - 1))}>Prev</button>
				<button onClick={() => setPage(page + 1)} disabled={!messages || messages.length < 10}>
					Next
				</button>
			</div>
		</div>
	)
}

export default App
