import { Canvas, Connection } from "@canvas-js/core"

declare global {
	function log(...args: any[]): void
	function updateConnections(connections: Record<string, Connection>): void
	function getBootstrapList(): string[]
	function getClients(): { clients: number }
	function shouldWrite(): boolean
}

const connections: Record<string, { numOnline: number; numWaiting: number }> = {}
const apps: Record<string, Canvas> = {}

const { clients: N } = await getClients()

for (let i = 0; i < N; i++) {
	try {
		const bootstrapList = await getBootstrapList()
		// const randId = Math.floor(Math.random() * 0xffffff).toString(16)
		const app = await Canvas.initialize({
			contract: {
				topic: `room-${i % 30}.canvas.xyz`,
				models: {},
				actions: {
					createMessage: () => {},
				},
			},
			indexHistory: false,
			ignoreMissingActions: true,
			//disablePing: true,
			discoveryTopic: "canvas-discovery",
			bootstrapList,
		})

		app.addEventListener("connections:updated", ({ detail }) => {
			const numOnline = Object.values(detail.connections).filter((conn) => conn.status === "online").length
			const numWaiting = Object.values(detail.connections).filter(
				(conn) => conn.status === "waiting" || conn.status === "connecting",
			).length
			connections[i.toString()] = { numOnline, numWaiting }
		})

		apps[i.toString()] = app

		let j = 0
		setInterval(async () => {
			if ((await shouldWrite()) && connections[i.toString()].numOnline > 0) {
				app.actions.createMessage({ content: j++ })
			}
		}, 1000)
	} catch (err) {
		log("err", err)
	}
}

let tick = 0
setInterval(() => {
	log("tick:", tick++)
	for (let i = 0; i < N; i++) {
		const { numOnline, numWaiting } = connections[i.toString()]
		log(i, numOnline, numWaiting, numOnline > 0 ? "🟢" : numWaiting > 0 ? "🟡" : "🔴")
	}
}, 1000)
