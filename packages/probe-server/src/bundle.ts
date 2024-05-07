import { Canvas, Connection } from "@canvas-js/core"

declare global {
	function log(...args: any[]): void
	function updateConnections(connections: Record<string, Connection>): void
}

Promise.all(
	[...Array(30).keys()].map(async (i) => {
		log("initializing", i)
		const randId = Math.floor(Math.random() * 0xffffff).toString(16)
		const app = await Canvas.initialize({
			contract: {
				topic: `room-${randId}.canvas.xyz`,
				models: {},
				actions: {
					createMessage: (db, { content }, { id, address, timestamp }) => {},
				},
			},
			indexHistory: false,
			ignoreMissingActions: true,
			disablePing: true,
			discoveryTopic: "canvas-discovery",
			bootstrapList: [
				"/dns4/canvas-chat-discovery-p0.fly.dev/tcp/443/wss/p2p/12D3KooWG1zzEepzv5ib5Rz16Z4PXVfNRffXBGwf7wM8xoNAbJW7",
				"/dns4/canvas-chat-discovery-p1.fly.dev/tcp/443/wss/p2p/12D3KooWNfH4Z4ayppVFyTKv8BBYLLvkR1nfWkjcSTqYdS4gTueq",
				"/dns4/canvas-chat-discovery-p2.fly.dev/tcp/443/wss/p2p/12D3KooWRBdFp5T1fgjWdPSCf9cDqcCASMBgcLqjzzBvptjAfAxN",
			],
		})

		let j = 1
		setInterval(() => {
			app.actions.createMessage({ content: j++ })
			const conns = app.libp2p.getConnections().length
			log(`headless ${i} sent ${j} messages, has ${conns} connections`)
		}, 1000)

		console.log(i)

		const connections: Record<string, Connection> = {}

		app.libp2p.addEventListener("connection:open", ({ detail: connection }) => {
			connections[connection.id] = connection
			//log(`[probe-server:${j}] new connection:`, connection.remoteAddr)
			updateConnections(connections)
			//log(`[probe-server:${j}] has connections:`, Object.keys(connections).length)
		})
		app.libp2p.addEventListener("connection:close", ({ detail: connection }) => {
			delete connections[connection.id]
			//log(`[probe-server:${j}] closed connection`, connection.remoteAddr)
			updateConnections(connections)
			//log(`[probe-server:${j}] has connections:`, Object.keys(connections).length)
		})
	}),
)
