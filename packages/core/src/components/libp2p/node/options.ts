import path from "node:path"
import fs from "node:fs"

import { register } from "prom-client"

import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import { prometheusMetrics } from "@libp2p/prometheus-metrics"

// import { PEER_ID_FILENAME } from "@canvas-js/core/constants"

import type { P2PConfig, ServiceMap } from "../types.js"
import { getBaseLibp2pOptions } from "../options.js"

export async function getLibp2pOptions(peerId: PeerId, config: P2PConfig): Promise<Libp2pOptions<ServiceMap>> {
	return {
		...getBaseLibp2pOptions(peerId, config),
		metrics: prometheusMetrics({ registry: register }),
	}
}
