export type Connection = { id: string; remotePeer: string; remoteAddr: string }

export type API = {
	"/api/state": {
		peerId: string
		apps: { topic: string; status: "started" | "stopped" }[]
		connections: Connection[]
	}
}
