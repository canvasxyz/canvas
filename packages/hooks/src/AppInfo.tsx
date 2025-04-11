import React, { useState, useEffect } from "react"
import { bytesToHex } from "@noble/hashes/utils"

import { Canvas, NetworkClient } from "@canvas-js/core"
import type { CanvasEvents } from "@canvas-js/core"
import { MessageId } from "@canvas-js/gossiplog"

export const AppInfo: React.FC<{
	app: Canvas | null | undefined
	ws: NetworkClient<any> | null | undefined
	styles?: React.CSSProperties
	buttonStyles?: React.CSSProperties
	popupStyles?: React.CSSProperties
}> = ({ app, ws, styles = {}, buttonStyles = {}, popupStyles = {} }) => {
	const [, setTick] = useState(0)
	const [isOpen, setIsOpen] = useState(false)
	const [remoteInfo, setRemoteInfo] = useState<any>(null)
	const [isLoadingInfo, setIsLoadingInfo] = useState(false)

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

	// Add escape key handler
	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsOpen(!isOpen)
			}
		}

		document.addEventListener("keydown", handleEscape)
		return () => document.removeEventListener("keydown", handleEscape)
	}, [isOpen])

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
			<div style={{ position: "fixed", top: "0.75rem", right: "1rem", ...styles }}>
				<div
					style={{
						border: "1px solid #ddd",
						borderRadius: "0.25rem",
						padding: "0.25rem 0.5rem",
						cursor: "pointer",
						backgroundColor: "white",
						color: "#222",
						...buttonStyles,
					}}
					onClick={() => setIsOpen(!isOpen)}
				>
					Info
				</div>
			</div>
			{isOpen && (
				<div
					style={{
						position: "fixed",
						top: "1.25rem",
						right: "1.75rem",
						fontSize: "0.875rem",
						zIndex: 9999,
						...popupStyles,
					}}
				>
					<div style={{ position: "absolute", top: "0.75rem", right: "0.75rem" }}>
						<button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700">
							✕
						</button>
					</div>
					<div
						style={{
							border: "1px solid #e5e7eb",
							borderRadius: "0.25rem",
							padding: "0.5rem 0.75rem",
							backgroundColor: "white",
							textAlign: "left",
							color: "#222",
							width: "360px",
							maxHeight: "90vh",
							overflow: "scroll",
						}}
					>
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
								({!ws ? "No remote provided" : ws.isConnected() ? "Connected" : "Disconnected"})
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
							</div>
						)}
					</div>
				</div>
			)}
		</>
	)
}
