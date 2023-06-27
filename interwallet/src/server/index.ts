import http from "node:http"

import chalk from "chalk"

import { app } from "./server.js"

import { libp2p } from "./libp2p.js"

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
		libp2p.stop()
		server.close()
		server.closeAllConnections()
	}
})
