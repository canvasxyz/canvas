export type Event =
	| { type: "start"; id: string; t: number; detail: { hostname: string } }
	| { type: "stop"; id: string; t: number; detail: {} }
	| { type: "connection:open"; id: string; t: number; detail: { id: string; remotePeer: string; remoteAddr: string } }
	| { type: "connection:close"; id: string; t: number; detail: { id: string; remotePeer: string; remoteAddr: string } }
	| { type: "gossipsub:mesh:update"; id: string; t: number; detail: { topic: string; peers: string[] } }
	| { type: "gossipsub:message"; id: string; t: number; detail: { topic: string; data: string } }
