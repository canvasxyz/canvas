import React, { useState, useEffect } from "react"
import { bytesToHex } from "@noble/hashes/utils"

import { Canvas, NetworkClient } from "@canvas-js/core"
import type { CanvasEvents } from "@canvas-js/core"
import { MessageId } from "@canvas-js/gossiplog"

export const AppInfo: React.FC<{
	app: Canvas | null | undefined
	ws: NetworkClient<any> | null | undefined
	styles?: React.CSSProperties
	collapsed?: boolean
}> = ({ app, ws, styles = {}, collapsed }) => {
	const [, setTick] = useState(0)
	const [remoteInfo, setRemoteInfo] = useState<any>(null)
	const [isLoadingInfo, setIsLoadingInfo] = useState(false)
	const [expanded, setExpanded] = useState(false)

	// Add effect to load remote info on mount
	useEffect(() => {
		if (ws === null || ws === undefined) return

		const fetchRemoteInfo = async () => {
			setIsLoadingInfo(true)
			try {
				const response = await fetch(ws.sourceURL.replace(/^ws(s)?:\/\//, "http$1://") + "/api")
				const data = await response.json()
				setRemoteInfo(data)
			} catch (error) {
				console.error("Failed to fetch remote info:", error)
				setRemoteInfo({ error: "Failed to fetch remote info" })
			}
			setIsLoadingInfo(false)
		}

		fetchRemoteInfo()
	}, [ws?.sourceURL])

	useEffect(() => {
		const timer = setInterval(() => {
			setTick((t) => t + 1)
		}, 1000)
		return () => clearInterval(timer)
	}, [])

	// Get root and heads
	const [root, setRoot] = useState<string | null>(null)
	const [heads, setHeads] = useState<string[] | null>(null)
	useEffect(() => {
		if (app === undefined || app === null) {
			return
		}

		app.messageLog.tree.read((txn) => txn.getRoot()).then((root) => setRoot(`${root.level}:${bytesToHex(root.hash)}`))
		app.db.query<{ id: string }>("$heads").then((records) => setHeads(records.map((record) => record.id)))

		const handleCommit = ({ detail: { root, heads } }: CanvasEvents["commit"]) => {
			const rootValue = `${root.level}:${bytesToHex(root.hash)}`
			setRoot(rootValue)
			setHeads(heads)
		}

		app.addEventListener("commit", handleCommit)
		return () => app.removeEventListener("commit", handleCommit)
	}, [app])

	if (!app) return

	return (
		<>
			{collapsed && !expanded ? (
				<a
					style={{
						display: "block",
						fontSize: "0.825em",
						marginTop: "0.25rem",
						color: "#3b82f6",
						cursor: "pointer",
					}}
					href="#"
					onClick={() => setExpanded(true)}
				>
					Show more
				</a>
			) : (
				<div style={{ fontSize: "0.825em", overflowWrap: "break-word", ...styles }}>
					<div>
						<span
							style={{
								lineHeight: "1.25rem",
							}}
						>
							Topic
						</span>
					</div>
					<div style={{ marginTop: "0.25rem" }}>
						<code
							style={{
								lineHeight: "1.25rem",
							}}
						>
							{app.topic}
						</code>
					</div>
					<hr style={{ margin: "0.5rem 0" }} />
					<div>
						<span
							style={{
								lineHeight: "1.25rem",
							}}
						>
							Connection
						</span>
					</div>
					<div style={{ marginTop: "0.25rem" }}>
						<code
							style={{
								lineHeight: "1.25rem",
							}}
						>
							{ws ? ws.sourceURL : "n/a"}
						</code>
						<span style={{ marginLeft: "0.5rem", color: "#6b7280" }}>
							({!ws ? "No remote provided" : ws.isConnected() ? "Connected" : "Disconnected"}, Sync: {app.syncStatus})
						</span>
					</div>
					<hr style={{ margin: "0.5rem 0" }} />
					<div
						style={{
							lineHeight: "1.25rem",
						}}
					>
						Local merkle root
					</div>
					<div style={{ marginTop: "0.25rem" }}>
						<ul style={{ listStyleType: "disc", paddingLeft: "1rem" }}>
							<li>
								{root !== null ? (
									<code
										style={{
											lineHeight: "1.25rem",
										}}
									>
										{root}
									</code>
								) : (
									<span style={{ fontStyle: "italic" }}>none</span>
								)}
							</li>
						</ul>
					</div>
					<hr style={{ margin: "0.5rem 0" }} />
					<div
						style={{
							lineHeight: "1.25rem",
						}}
					>
						Local message heads
					</div>
					<div style={{ marginTop: "0.25rem" }}>
						{heads !== null ? (
							<ul style={{ listStyleType: "disc", paddingLeft: "1rem" }}>
								{heads.map((head) => (
									<li key={head}>
										<code
											style={{
												lineHeight: "1.25rem",
											}}
										>
											{head}
										</code>
										<br />
										<span style={{ color: "#6b7280" }}>(clock: {MessageId.encode(head).clock})</span>
									</li>
								))}
								{heads.length === 0 && (
									<li>
										<code
											style={{
												lineHeight: "1.25rem",
											}}
										>
											None
										</code>
										<br />
										<span style={{ color: "#6b7280" }}>(clock: 0)</span>
									</li>
								)}
							</ul>
						) : (
							<span style={{ fontStyle: "italic" }}>none</span>
						)}
					</div>
					{remoteInfo && (
						<div>
							<hr style={{ margin: "0.5rem 0" }} />
							<div
								style={{
									lineHeight: "1.25rem",
								}}
							>
								Remote merkle root
							</div>
							<div style={{ marginTop: "0.25rem" }}>
								<ul style={{ listStyleType: "disc", paddingLeft: "1rem" }}>
									<li>
										<code>{remoteInfo.root}</code>
									</li>
								</ul>
								<hr style={{ margin: "0.5rem 0" }} />
								<div>Remote message heads</div>
								<ul style={{ listStyleType: "disc", paddingLeft: "1rem" }}>
									{remoteInfo.heads.map((head: string) => {
										return (
											<li key={head}>
												<code
													style={{
														lineHeight: "1.25rem",
													}}
												>
													{head}
												</code>
												<br />
												<span style={{ color: "#6b7280" }}>(clock: {MessageId.encode(head).clock})</span>
											</li>
										)
									})}
									{remoteInfo.heads.length === 0 && (
										<li>
											<code
												style={{
													lineHeight: "1.25rem",
												}}
											>
												None
											</code>
											<br />
											<span style={{ color: "#6b7280" }}>(clock: 0)</span>
										</li>
									)}
								</ul>
							</div>
							<hr style={{ margin: "0.5rem 0" }} />
							<div
								style={{
									lineHeight: "1.25rem",
								}}
							>
								Remote storage
							</div>
							<div style={{ marginTop: "0.25rem" }}>
								<code>{remoteInfo.database}</code>
							</div>
						</div>
					)}

					{ws && (
						<div>
							<hr style={{ margin: "0.5rem 0" }} />
							<button
								style={{
									display: "block",
									marginTop: "0.25rem",
									color: "#3b82f6",
									cursor: "pointer",
								}}
								onClick={async () => {
									if (ws === null || ws === undefined) return
									setIsLoadingInfo(true)
									try {
										const response = await fetch(ws.sourceURL.replace(/^ws(s)?:\/\//, "http$1://") + "/api")
										const data = await response.json()
										setRemoteInfo(data)
									} catch (error) {
										console.error("Failed to fetch remote info:", error)
										setRemoteInfo({ error: "Failed to fetch remote info" })
									}
									setIsLoadingInfo(false)
								}}
							>
								{isLoadingInfo ? "Loading..." : "Refresh"}
							</button>

							<a
								href={ws?.sourceURL.replace(/^ws(s)?:\/\//, "http$1://") + "/explorer"}
								target="_blank"
								rel="noopener noreferrer"
								style={{
									display: "block",
									marginTop: "0.25rem",
									color: "#3b82f6",
									cursor: "pointer",
								}}
							>
								Manage remote →
							</a>

							{collapsed && (
								<a
									href="#"
									style={{
										display: "block",
										marginTop: "0.25rem",
										color: "#3b82f6",
										cursor: "pointer",
									}}
									onClick={() => setExpanded(false)}
								>
									Show less
								</a>
							)}
						</div>
					)}
				</div>
			)}
		</>
	)
}
