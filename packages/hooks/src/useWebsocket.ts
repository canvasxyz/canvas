import { useState, useEffect } from "react"

const WS_KEEPALIVE = 30000

const setupWebsocket = (host: string, onclose: () => void) => {
	const wsHost = host.startsWith("/") ? `ws://${document.location.host}${host}` : host
	const ws: WebSocket & { waitingForHeartbeat?: boolean } = new WebSocket(wsHost)

	// Set up keep-alive
	ws.addEventListener("open", () => {
		ws.waitingForHeartbeat = false
		ws.addEventListener("pong", () => (ws.waitingForHeartbeat = false))
	})
	const timer = setInterval(() => {
		if (ws.readyState !== ws.OPEN) return
		if (ws.waitingForHeartbeat === true) {
			console.log("ws: server timed out")
			ws.close()
			clearInterval(timer)
			onclose()
		} else {
			ws.waitingForHeartbeat = true
			ws.send("ping")
		}
	}, WS_KEEPALIVE)

	ws.addEventListener("close", () => {
		console.log("ws: connection closed")
		clearInterval(timer)
		onclose()
	})

	window.addEventListener("beforeunload", () => {
		console.log("ws: window unloading")
		ws.close()
		onclose()
	})

	return ws
}

export function useWebsocket({ isLoading, host }: { isLoading: boolean; host: string }): WebSocket | null {
	const [ws, setWS] = useState<WebSocket | null>(null)

	useEffect(() => {
		if (isLoading) return
		const ws = setupWebsocket(host, () => {
			setWS(null)
		})
		setWS(ws)
	}, [isLoading, host])

	return ws
}
