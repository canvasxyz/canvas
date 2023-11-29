import React, { useCallback, useState, useEffect, useRef } from "react"
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"
import { PublicChat } from "@canvas-js/templates"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { defaultBootstrapList } from "@canvas-js/core"

import { ethers } from "ethers"

const toFormattedDate = (timestamp) => {
	return new Date(timestamp).toLocaleTimeString("en-US")
}

const MessagingDemo = () => {
	const inputRef = useRef()
	const [showPeers, setShowPeers] = useState()

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

	const [synced, setSynced] = useState(false)
	const [connections, setConnections] = useState([])
	const connectionsRef = useRef(connections)

	const handleConnectionOpen = useCallback(({ detail: connection }) => {
		const connections = [...connectionsRef.current, connection]
		setConnections(connections)
		connectionsRef.current = connections
	}, [])

	const handleConnectionClose = useCallback(({ detail: connection }) => {
		const connections = connectionsRef.current.filter(({ id }) => id !== connection.id)
		setConnections(connections)
		connectionsRef.current = connections
	}, [])

	const handleSync = useCallback(({ detail: { messageCount, peer } }) => {
		setSynced(true)
		console.log(`synced with ${peer} (${messageCount} messages)`)
	}, [])

	useEffect(() => {
		if (!app) return () => {}
		setTimeout(() => {
			app.start()
		}, 700)

		app.libp2p?.addEventListener("connection:open", handleConnectionOpen)
		app.libp2p?.addEventListener("connection:close", handleConnectionClose)
		app.messageLog?.addEventListener("sync", handleSync)
		return () => {
			app.libp2p?.removeEventListener("connection:open", handleConnectionOpen)
			app.libp2p?.removeEventListener("connection:close", handleConnectionClose)
			app.messageLog?.removeEventListener("sync", handleSync)
			app.stop()
		}
	}, [app])

	const onSubmit = async (e) => {
		e.preventDefault()

		const message = inputRef.current.value
		app.actions.sendMessage({ message }).then(() => {
			inputRef.current.value = ""
		})
	}

	return (
		<div>
			<div className="democell-internal">
				<div style={{ marginBottom: 12 }}>
					{threads?.length === 0 && <div style={{ opacity: 0.6 }}>No messages yet</div>}
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
				<div className="peers" onClick={() => setShowPeers(!showPeers)}>
					{connections.filter((conn) => defaultBootstrapList.indexOf(conn.remoteAddr.toString()) === -1).length} peers
					{synced ? "" : connections.length === 0 ? ", waiting..." : ", syncing..."}
				</div>
			</div>
			{showPeers && (
				<div className="peer-details">
					{connections.map((conn) => (
						<div>
							{defaultBootstrapList.indexOf(conn.remoteAddr.toString()) !== -1
								? "[bootstrap] "
								: `[${conn?.direction}] `}
							{conn?.remoteAddr.toString()}
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export default MessagingDemo
