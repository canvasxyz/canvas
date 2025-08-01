// Workers

import { signalInvalidType } from "@canvas-js/utils"

type WorkerEventTypes = {
	"worker:start": {}
	"worker:stop": {}
	"peer:start": { id: string }
	"peer:stop": { id: string }
	"worker:autospawn": {
		total: number | null
		lifetime: number | null
		publishInterval: number | null
		spawnInterval: number | null
	}
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
	"peer:start": CustomEvent<{ publishInterval?: number | null; lifetime?: number | null }>
	"peer:stop": CustomEvent<{ id: string }>
}

// Peers

type PeerEventTypes = {
	start: {
		workerId: string | null
		root: string | null
		topic: string | null
		clock: number | null
		heads: string[] | null
	}
	stop: {}
	"connection:open": { id: string; remotePeer: string; remoteAddr: string }
	"connection:close": { id: string; remotePeer: string; remoteAddr: string }
	"gossipsub:mesh:update": { topic: string; peers: string[] }
	"gossiplog:commit": { topic: string; root: string; clock: number; heads: string[] }
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
	workers: {
		id: string
		autospawn: {
			total: number
			lifetime: number
			publishInterval: number
			spawnInterval: number
		} | null
	}[]

	// Peers
	mesh: Record<string, string[]>
	nodes: { id: string; topic: string | null; workerId: string | null }[]
	links: { id: string; source: string; target: string }[]
	roots: Record<string, { clock: number | null; heads: string[] | null; root: string | null }>
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
				const { topic, workerId, clock, heads, root } = event.detail
				return {
					...state,
					nodes: [...state.nodes, { id: event.peerId, topic, workerId }],
					roots: { ...state.roots, [event.peerId]: { clock, heads, root } },
				}
			}
		} else if (event.type === "stop") {
			const peerId = event.peerId
			const { [peerId]: oldRoot, ...roots } = state.roots
			const { [peerId]: oldMesh, ...mesh } = state.mesh
			const links = state.links.filter((link) => link.source !== peerId && link.target !== peerId)
			const nodes = state.nodes.filter((node) => node.id !== peerId)
			return { ...state, roots, mesh, links, nodes }
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
			const prev = state.roots[event.peerId] ?? {}
			const { clock, heads, root } = event.detail
			return {
				...state,
				roots: { ...state.roots, [event.peerId]: { ...prev, clock, heads, root } },
			}
		} else {
			signalInvalidType(event)
		}
	} else if (event.source === "worker") {
		if (event.type === "worker:start") {
			if (state.workers.every((worker) => worker.id !== event.workerId)) {
				return { ...state, workers: [...state.workers, { id: event.workerId, autospawn: null }] }
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
		} else if (event.type === "worker:autospawn") {
			return {
				...state,
				workers: state.workers.map((worker) => {
					if (worker.id !== event.workerId) {
						return worker
					}

					const { lifetime, total, publishInterval, spawnInterval } = event.detail
					if (lifetime !== null && total !== null && publishInterval !== null && spawnInterval !== null) {
						return { ...worker, autospawn: { lifetime, total, publishInterval, spawnInterval } }
					} else {
						return { ...worker, autospawn: null }
					}
				}),
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
