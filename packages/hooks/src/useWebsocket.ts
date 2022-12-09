import { useState, useEffect } from "react"

const WS_KEEPALIVE = 3000

type WebSocketExt = {
	waitingForHeartbeat?: boolean
	timer?: ReturnType<typeof setTimeout>
}

const setupWebsocket = (host: string, reconnect: Function, delay: number) => {
	const wsHost = host.startsWith("/") ? `ws://${document.location.host}${host}` : host
	const ws: WebSocket & WebSocketExt = new WebSocket(wsHost)

	// Set up keep-alive
	ws.addEventListener("message", (event) => {
		if (event.data === "pong") ws.waitingForHeartbeat = false
	})
	ws.addEventListener("open", (event) => {
		ws.timer = setInterval(() => {
			if (ws.readyState !== ws.OPEN) return
			if (ws.waitingForHeartbeat === true) {
				console.log("ws: closing connection, server did not respond to keep-alive")
				ws.close()
				clearInterval(ws.timer)
				reconnect(delay)
			} else {
				ws.waitingForHeartbeat = true
				ws.send("ping")
			}
		}, WS_KEEPALIVE)
	})

	ws.addEventListener("close", () => {
		console.log("ws: connection closed")
		clearInterval(ws.timer)
		reconnect(delay)
	})

	return ws
}

export function useWebsocket({ isLoading, host }: { isLoading: boolean; host: string }): WebSocket | null {
	const [ws, setWS] = useState<WebSocket | null>(null)

	useEffect(() => {
		if (isLoading) return
		// Set up a websocket, and re-connect whenever connection fails
		const reconnect = (delay: number) => {
			const newDelay = delay < 10000 ? delay + 1000 : delay
			setTimeout(() => setWS(setupWebsocket(host, reconnect, newDelay)), delay)
		}
		setWS(setupWebsocket(host, reconnect, 0))
	}, [isLoading, host])

	return ws
}
