import { setTimeout } from "node:timers/promises"

import { randomBytes, randomUUID } from "node:crypto"

import test from "ava"
import { nanoid } from "nanoid"
import * as lp from "it-length-prefixed"
import { pushable } from "it-pushable"
import { pipe } from "it-pipe"
import { Uint8ArrayList } from "uint8arraylist"
import { CodeError } from "@libp2p/interface"
import { createEd25519PeerId } from "@libp2p/peer-id-factory"
import { multiaddr } from "@multiformats/multiaddr"

import { assert, SECONDS } from "@canvas-js/utils"
import type { GossipLogConsumer, GossipLogEvents } from "@canvas-js/gossiplog"

import { Request, Response } from "@canvas-js/gossiplog/protocols/sync"
import { NetworkClient } from "@canvas-js/gossiplog/client"
import { NetworkServer } from "@canvas-js/gossiplog/server"

import { testPlatforms, expectLogEntries, getDirectory } from "./utils.js"

import { createNetwork } from "./libp2p.js"

const apply: GossipLogConsumer<string> = ({}) => {}

testPlatforms(
	"ws publish",
	async (t, openGossipLog) => {
		const topic = randomUUID()
		const a = await openGossipLog(t, { topic, apply })
		const b = await openGossipLog(t, { topic, apply })
		const c = await openGossipLog(t, { topic, apply })

		await a.listen(5555)
		await b.connect("ws://127.0.0.1:5555")
		await c.connect("ws://127.0.0.1:5555")

		await setTimeout(1000)

		const { id, signature, message } = await b.append(nanoid())

		await setTimeout(1000)

		t.deepEqual(await c.get(id), [signature, message])

		t.pass()
	},
	{ sqlite: true },
)
