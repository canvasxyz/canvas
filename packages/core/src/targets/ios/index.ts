import type pg from "pg"
import type { SqlStorage } from "@cloudflare/workers-types"

import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	async openGossipLog(
		location: { path: string | pg.ConnectionConfig | SqlStorage | null; topic: string; clear?: boolean },
		init,
	) {
		if (location.path === null) {
			const { GossipLog: SqliteGossipLog } = await import("@canvas-js/gossiplog/sqlite")
			return new SqliteGossipLog(init)
		} else {
			throw new Error("Unimplemented named sqlite dbs")
		}
	},

	async listen(app, port, options = {}) {
		throw new Error("Unimplemented for iOS")

		// const api = express()
		// api.use(cors())
		// api.use("/api", createAPI(app))

		// // TODO: add metrics API

		// const server = http.createServer(api)
		// const network = new NetworkServer(app.messageLog)
		// const wss = new WebSocketServer({ server, perMessageDeflate: false })
		// wss.on("connection", network.handleConnection)

		// const signal = anySignal([app.messageLog.controller.signal, options.signal])
		// signal.addEventListener("abort", () => {
		// 	network.close()
		// 	wss.close(() => server.close())
		// })

		// await new Promise<void>((resolve) => server.listen(port, resolve))
	},
}

export default target
