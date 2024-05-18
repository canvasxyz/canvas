import { Canvas, Connection } from "@canvas-js/core"

declare global {
	function log(...args: any[]): void
	function updateConnections(connections: Record<string, Connection>): void
}

const randId = Math.floor(Math.random() * 0xffffff).toString(16)
const app = await Canvas.initialize({
	contract: { topic: `room-${randId}.canvas.xyz`, models: {}, actions: {} },
	indexHistory: false,
	ignoreMissingActions: true,
	disablePing: true,
	discoveryTopic: "canvas-discovery",
	bootstrapList: [
		"/dns4/test-discovery-p0.fly.dev/tcp/443/wss/p2p/12D3KooWSndvFSJtqq9NT4qQxB7jni6styhfuY4cZhdavq7daeJe",
		"/dns4/test-discovery-p1.fly.dev/tcp/443/wss/p2p/12D3KooWDoRTPYYdYEgJBptAF7MEZjYV4J82rBp8BoyKe1AXtxgA",
		"/dns4/test-discovery-p2.fly.dev/tcp/443/wss/p2p/12D3KooWQFJcBXTT5LH2aGJzyYRPkBPd4WsqxccmLwpvn6DxLFdq",
	],
})

const connections: Record<string, Connection> = {}

app.libp2p.addEventListener("connection:open", ({ detail: connection }) => {
	connections[connection.id] = connection
	log("[probe-server] new connection:", connection.remoteAddr)
	updateConnections(connections)
})
app.libp2p.addEventListener("connection:close", ({ detail: connection }) => {
	delete connections[connection.id]
	log("[probe-server] closed connection", connection.remoteAddr)
	updateConnections(connections)
})
