import { CodeError } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import { yamux } from "@chainsafe/libp2p-yamux"
import { select, handle } from "@libp2p/multistream-select"

import WebSocket from "it-ws/web-socket"
import { createServer, WebSocketServer } from "it-ws/server"
import { connect } from "it-ws/client"
import { pipe } from "it-pipe"
import { Uint8ArrayList } from "uint8arraylist"

import { AbstractGossipLog } from "../AbstractGossipLog.js"
import { Server } from "../sync/server.js"
import { Client } from "../sync/client.js"

export const factory = yamux({})({ logger: { forComponent: logger } })

export const getSyncProtocol = (topic: string) => `/canvas/v1/${topic}/sync`
export const getPushProtocol = (topic: string) => `/canvas/v1/${topic}/push`

export async function* chunk(iter: AsyncIterable<Uint8ArrayList | Uint8Array>) {
	for await (const item of iter) {
		yield item.subarray()
	}
}
