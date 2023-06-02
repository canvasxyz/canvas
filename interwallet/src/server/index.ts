import http from "node:http"

import chalk from "chalk"

import { getPeerId } from "./libp2p.js"
import { RoomManager } from "./manager.js"
import { app } from "./server.js"

const peerId = await getPeerId()
const manager = await RoomManager.initialize(peerId)
await manager.start()

const { PORT } = process.env
const server = http.createServer(app).listen(parseInt(PORT ?? "8088"))

let stopping = false
process.on("SIGINT", () => {
	if (stopping) {
		process.exit(1)
	} else {
		process.stdout.write(
			`\n${chalk.yellow("Received SIGINT, attempting to exit gracefully. ^C again to force quit.")}\n`
		)

		stopping = true
		manager.stop()
		server.close()
		server.closeAllConnections()
	}
})
