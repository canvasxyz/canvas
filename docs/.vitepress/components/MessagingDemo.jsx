import React, { useState, useEffect, useRef } from "react"
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"
import { PublicChat } from "@canvas-js/templates"
import { SIWESigner } from "@canvas-js/chain-ethereum"

import { ethers } from "ethers"

const toFormattedDate = (timestamp) => {
	return new Date(timestamp).toLocaleTimeString("en-US")
}

const MessagingDemo = () => {
	const inputRef = useRef()

	let privateKey = localStorage.getItem("privatekey")
	if (privateKey === null) {
		privateKey = ethers.Wallet.createRandom().privateKey
		localStorage.setItem("privatekey", privateKey)
	}
	const wallet = new ethers.Wallet(privateKey)

	const { app } = useCanvas({
		contract: { ...PublicChat, topic: "canvas-example-public-chat" },
		signers: [new SIWESigner({ signer: wallet })],
	})

	const threads = useLiveQuery(app, "messages", {
		limit: 5,
		orderBy: { timestamp: "desc" },
	})

	const onSubmit = async (e) => {
		e.preventDefault()

		const message = inputRef.current.value
		app.actions.sendMessage({ message }).then(() => {
			inputRef.current.value = ""
		})
	}

	return (
		<div>
			<div style={{ marginBottom: 12 }}>
				{threads?.map((thread) => (
					<div style={{ display: "flex" }} key={thread.id}>
						<div style={{ flex: 1 }}>{thread.message}</div>
						<div style={{ opacity: 0.4 }}>{toFormattedDate(thread.timestamp)}</div>
					</div>
				))}
			</div>
			<form onSubmit={onSubmit}>
				<input type="text" ref={inputRef} placeholder="Type a message..." />
			</form>
		</div>
	)
}

export default MessagingDemo
