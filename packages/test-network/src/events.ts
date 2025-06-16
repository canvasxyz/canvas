// Workers

import { signalInvalidType } from "@canvas-js/utils"

type WorkerEventTypes = {
	"worker:start": {}
	"worker:stop": {}
	"peer:start": { id: string }
	"peer:stop": { id: string }
}

export type WorkerEvent = {
	[K in keyof WorkerEventTypes]: {
		source: "worker"
		type: K
		workerId: string
		timestamp: number
		detail: WorkerEventTypes[K]
	}
}[keyof WorkerEventTypes]

export type WorkerActions = {
	"peer:start": CustomEvent<{ interval?: number | null; times?: number | null }>
	"peer:stop": CustomEvent<{ id: string }>
}

// Peers

type PeerEventTypes = {
	start: { workerId: string | null; root: string | null; topic: string | null }
	"connection:open": { id: string; remotePeer: string; remoteAddr: string }
	"connection:close": { id: string; remotePeer: string; remoteAddr: string }
	"gossipsub:mesh:update": { topic: string; peers: string[] }
	"gossiplog:commit": { topic: string; root: string }
}

export type PeerEvent = {
	[K in keyof PeerEventTypes]: { source: "peer"; type: K; peerId: string; timestamp: number; detail: PeerEventTypes[K] }
}[keyof PeerEventTypes]

export type PeerActions = {
	append: CustomEvent<{}>
	provide: CustomEvent<{}>
	query: CustomEvent<{}>
	disconnect: CustomEvent<{ target: string }>
}

// State

export type NetworkEvent = PeerEvent | WorkerEvent | { source: "network"; type: "snapshot"; state: NetworkState }

export type NetworkState = {
	// Workers
	workers: { id: string }[]

	// Peers
	mesh: Record<string, string[]>
	nodes: { id: string; topic: string | null; workerId: string | null }[]
	links: { id: string; source: string; target: string }[]
	roots: Record<string, string | null>
}

export const initialState: NetworkState = { mesh: {}, nodes: [], links: [], roots: {}, workers: [] }

export function reduce(state: NetworkState, event: NetworkEvent): NetworkState {
	if (event.source === "network") {
		if (event.type === "snapshot") {
			return event.state
		} else {
			signalInvalidType(event)
		}
	} else if (event.source === "peer") {
		if (event.type === "start") {
			if (state.nodes.every((node) => node.id !== event.peerId)) {
				return {
					...state,
					nodes: [...state.nodes, { id: event.peerId, topic: event.detail.topic, workerId: event.detail.workerId }],
					roots: { ...state.roots, [event.peerId]: event.detail.root },
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
		} else {
			signalInvalidType(event)
		}
	} else if (event.source === "worker") {
		if (event.type === "worker:start") {
			if (state.workers.every((worker) => worker.id !== event.workerId)) {
				return { ...state, workers: [...state.workers, { id: event.workerId }] }
			}
		} else if (event.type === "worker:stop") {
			const roots = { ...state.roots }
			const mesh = { ...state.mesh }
			const nodes = new Set<string>()
			for (const node of state.nodes) {
				if (node.workerId === event.workerId) {
					delete roots[node.id]
					delete mesh[node.id]
					nodes.add(node.id)
				}
			}

			return {
				...state,
				nodes: state.nodes.filter((node) => node.workerId !== event.workerId),
				links: state.links.filter((link) => !nodes.has(link.source) && !nodes.has(link.target)),
				roots,
				mesh,
				workers: state.workers.filter((worker) => worker.id !== event.workerId),
			}
		} else if (event.type === "peer:start") {
			// ...
		} else if (event.type === "peer:stop") {
			const peerId = event.detail.id
			const { [peerId]: oldRoot, ...roots } = state.roots
			const { [peerId]: oldMesh, ...mesh } = state.mesh
			const links = state.links.filter((link) => link.source !== peerId && link.target !== peerId)
			const nodes = state.nodes.filter((node) => node.id !== peerId)
			return { ...state, roots, mesh, links, nodes }
		} else {
			signalInvalidType(event)
		}
	} else {
		signalInvalidType(event)
	}

	return state
}
