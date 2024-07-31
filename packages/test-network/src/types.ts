type EventTypes = {
	start: { root: string }
	stop: {}
	"connection:open": { id: string; remotePeer: string; remoteAddr: string }
	"connection:close": { id: string; remotePeer: string; remoteAddr: string }
	"gossipsub:mesh:update": { topic: string; peers: string[] }
	"gossiplog:commit": { topic: string; root: string }
}

export type Event = {
	[K in keyof EventTypes]: { type: K; peerId: string; timestamp: number; detail: EventTypes[K] }
}[keyof EventTypes]
