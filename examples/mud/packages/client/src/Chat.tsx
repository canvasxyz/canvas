import React, { useRef, useState, useEffect } from "react"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"

import { useCanvas, useLiveQuery } from "@canvas-js/hooks"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { getBurnerPrivateKey } from "@latticexyz/common"
import { ethers } from "ethers"

type Message = {
	id: 'string',
	message: 'string',
	address: 'string',
	timestamp: 'number'
}

export const Chat = () => {
	const [signer] = useState(() => new ethers.Wallet(getBurnerPrivateKey()))
	const [chatOpen, setChatOpen] = useState(true)
	const scrollboxRef = useRef<VirtuosoHandle>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	// localStorage["mud:burnerWallet"]

	const { app } = useCanvas({
		contract: {
			models: {
				messages: {
					id: "primary",
					message: "string",
					address: "string",
					timestamp: "integer",
				},
			},
			actions: {
				sendMessage: (db, { message }, { id, address, timestamp }) => {
					db.set("messages", { id, message, address, timestamp })
				},
			},
			topic: "xyz.canvas.examples",
		},
		signers: [new SIWESigner({ signer })],
	})
	const messages = useLiveQuery<Message>(app, "messages")

	// set up app onload
	useEffect(() => {
		if (!app) return

		// peers
	}, [app])

	const toggleChatOpen = () => {
		setChatOpen((open) => !open)
		window.requestAnimationFrame(() => {
			setTimeout(() => {
				if (scrollboxRef.current) scrollboxRef.current.scrollToIndex(9999)
			}, 10)
		})
	}

	// bind global hotkey
	useEffect(() => {
		const keyup = (e: KeyboardEvent) => {
			if ((e.code === "Enter" && (e.target as HTMLInputElement).nodeName !== "INPUT") || e.code === "Escape") {
				toggleChatOpen()
			}
		}
		document.addEventListener("keyup", keyup)
		return () => document.removeEventListener("keyup", keyup)
	}, [app])

	return (
		<div
			style={{
				border: "1px solid",
				borderBottom: "none",
				position: "fixed",
				bottom: 0,
				left: 30,
				width: 280,
			}}
		>
			<div
				style={{
					width: "100%",
					padding: 10,
				}}
				onClick={() => toggleChatOpen()}
			>
				Chat
			</div>
			{chatOpen && (
				<div style={{ borderTop: "1px solid" }}>
					<Virtuoso
						ref={scrollboxRef}
						style={{ padding: 10, height: 250, overflowY: "scroll" }}
						data={messages || []}
						followOutput="auto"
						itemContent={(index, message) => 
							<div key={message.id as string}>
								{message.address.slice(0, 15)}: {message.message}
							</div>
						}
					/>
					<form
						style={{ padding: 10 }}
						onSubmit={async (event) => {
							event.preventDefault()

							const message = inputRef.current?.value
							if (!app || !message || !message.trim()) return

							app.actions.sendMessage({ message }).then(() => {
								if (inputRef.current) {
									inputRef.current.value = ""
								}
							})
						}}
					>
						<input
							autoFocus
							ref={inputRef}
							type="text"
							placeholder="Send a message"
							onKeyPress={(e) => {
								e.stopPropagation()
							}}
						/>{" "}
						<input type="submit" value="Send" />
					</form>
				</div>
			)}
		</div>
	)
}
