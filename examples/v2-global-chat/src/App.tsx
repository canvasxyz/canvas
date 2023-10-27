import { useState, useRef, type FormEvent } from "react"
import { ethers } from "ethers"
import "./App.css"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { PublicChat } from "@canvas-js/templates"
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"

function App() {
	const wallet = ethers.Wallet.createRandom()
	const { app } = useCanvas({
		contract: { ...PublicChat, topic: "canvas-example-chat-global" },
		signers: [new SIWESigner({ signer: wallet })],
	})

	const inputRef = useRef<HTMLInputElement>(null)
	const [page, setPage] = useState(0)
	const [sending, setSending] = useState(false)

	const messages = useLiveQuery<{ id: string; address: string; message: string; timestamp: number }>(app, "messages", {
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
					<div key={message.id}>
						{message.address}: {message.message}
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
