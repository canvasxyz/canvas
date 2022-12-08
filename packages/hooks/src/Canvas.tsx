import { ethers } from "ethers"
import React, { useState, useEffect } from "react"

import { CanvasContext, ApplicationData } from "./CanvasContext.js"

const WS_KEEPALIVE = 3000 // TODO: 30SEC

export interface CanvasProps {
	host: string
	children: React.ReactNode
}

export const Canvas: React.FC<CanvasProps> = (props) => {
	const [isLoading, setIsLoading] = useState(true)
	const [ws, setWS] = useState<WebSocket | null>(null)
	const [waitingForHeartbeat, setWaitingForHeartbeat] = useState<boolean>(false)
	const [data, setData] = useState<ApplicationData | null>(null)
	const [error, setError] = useState<Error | null>(null)

	const [signer, setSigner] = useState<ethers.providers.JsonRpcSigner | null>(null)
	const [sessionWallet, setSessionWallet] = useState<ethers.Wallet | null>(null)
	const [sessionExpiration, setSessionExpiration] = useState<number | null>(null)

	const host = props.host

	useEffect(() => {
		const wsHost = host.startsWith("/") ? `ws://${document.location.host}${host}` : host
		const ws = new WebSocket(wsHost)

		// Set up keep-alive
		ws.addEventListener("open", () => {
			setWaitingForHeartbeat(false)
			ws.addEventListener("pong", () => {
				console.log("pong")
				setWaitingForHeartbeat(false)
			})
		})
		const interval = setInterval(() => {
			if (ws.readyState !== ws.OPEN) return
			if (waitingForHeartbeat === true) {
				console.log("ws: server timed out")
				ws.close()
				setWS(null)
				clearInterval(interval)
				// TODO: try to reconnect
			} else {
				setWaitingForHeartbeat(true)
				ws.send("ping")
			}
		}, WS_KEEPALIVE)

		setWS(ws)
		return () => {
			ws.close()
			setWS(null)
			clearInterval(interval)
		}
	}, [host])

	useEffect(() => {
		const id = setInterval(() => {
			fetch(host)
				.then((res) => res.json())
				.then((data: ApplicationData) => setData(data))
				.catch((err) => setError(err))
				.finally(() => setIsLoading(false))
		}, 2500)
		return () => clearInterval(id)
	}, [host])

	return (
		<CanvasContext.Provider
			value={{
				isLoading,
				error,
				host,
				data,
				ws,
				signer,
				setSigner,
				sessionWallet,
				setSessionWallet,
				sessionExpiration,
				setSessionExpiration,
			}}
		>
			{props.children}
		</CanvasContext.Provider>
	)
}
