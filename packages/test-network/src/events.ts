type EventTypes = {
	start: { root?: string; topic: string | null }
	stop: {}
	"connection:open": { id: string; remotePeer: string; remoteAddr: string }
	"connection:close": { id: string; remotePeer: string; remoteAddr: string }
	"gossipsub:mesh:update": { topic: string; peers: string[] }
	"gossiplog:commit": { topic: string; root: string }
}

export type Event = {
	[K in keyof EventTypes]: { type: K; peerId: string; timestamp: number; detail: EventTypes[K] }
}[keyof EventTypes]

export type State = {
	mesh: Record<string, string[]>
	nodes: { id: string; topic: string | null }[]
	links: { id: string; source: string; target: string }[]
	roots: Record<string, string | null>
}

export const initialState: State = { mesh: {}, nodes: [], links: [], roots: {} }

export function reduce(state: State, event: Event): State {
	if (event.type === "start") {
		if (state.nodes.every((node) => node.id !== event.peerId)) {
			return {
				...state,
				nodes: [...state.nodes, { id: event.peerId, topic: event.detail.topic }],
				roots: { ...state.roots, [event.peerId]: event.detail.root ?? null },
			}
		}
	} else if (event.type === "connection:open") {
		if (state.links.every((link) => link.id !== event.detail.id)) {
			return {
				...state,
				links: [...state.links, { id: event.detail.id, source: event.peerId, target: event.detail.remotePeer }],
			}
		}
	} else if (event.type === "connection:close") {
		return { ...state, links: state.links.filter((link) => link.id !== event.detail.id) }
	} else if (event.type === "gossipsub:mesh:update") {
		return { ...state, mesh: { ...state.mesh, [event.peerId]: event.detail.peers } }
	} else if (event.type === "gossiplog:commit") {
		return {
			...state,
			roots: { ...state.roots, [event.peerId]: event.detail.root },
		}
	} else if (event.type === "stop") {
		const { [event.peerId]: _root, ...roots } = state.roots
		const { [event.peerId]: _mesh, ...mesh } = state.mesh
		const links = state.links.filter((link) => link.source !== event.peerId && link.target !== event.peerId)
		const nodes = state.nodes.filter((node) => node.id !== event.peerId)
		return { roots, mesh, links, nodes }
	}

	return state
}
