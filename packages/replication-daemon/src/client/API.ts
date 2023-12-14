export type Connection = { id: string; remotePeer: string; remoteAddr: string }

export type API = {
	"/api/state": {
		peerId: string
		apps: { topic: string; status: "started" | "stopped" }[]
		connections: Connection[]
	}
}

// @ts-ignore
export const host = import.meta.env.VITE_API_URL ?? ""
console.log("GOT VITE_API_URL", host)
