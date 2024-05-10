export type Event =
	| { type: "start"; id: string; t: number; detail: { hostname: string; rootLevel: number; rootHash: string } }
	| { type: "stop"; id: string; t: number; detail: {} }
	| { type: "connection:open"; id: string; t: number; detail: { id: string; remotePeer: string; remoteAddr: string } }
	| { type: "connection:close"; id: string; t: number; detail: { id: string; remotePeer: string; remoteAddr: string } }
	| { type: "gossipsub:mesh:update"; id: string; t: number; detail: { topic: string; peers: string[] } }
	| { type: "gossiplog:message"; id: string; t: number; detail: { topic: string; id: string } }
	| { type: "gossiplog:commit"; id: string; t: number; detail: { topic: string; rootLevel: number; rootHash: string } }
