import { randomUUID } from "node:crypto"
import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"

import { ed25519 } from "@canvas-js/signatures"

import type { GossipLogConsumer } from "@canvas-js/gossiplog"
import { testPlatforms } from "./utils.js"

const apply: GossipLogConsumer<string, string> = ({ message: { payload } }) => bytesToHex(sha256(payload))

testPlatforms(
	"get apply result",
	async (t, openGossipLog) => {
		const topic = randomUUID()
		const log = await openGossipLog(t, { topic, apply })

		const signer = ed25519.create()
		const { result: resultA } = await log.append("foo", { signer })
		const { result: resultB } = await log.append("bar", { signer })
		const { result: resultC } = await log.append("baz", { signer })

		t.is(resultA, bytesToHex(sha256("foo")))
		t.is(resultB, bytesToHex(sha256("bar")))
		t.is(resultC, bytesToHex(sha256("baz")))
	},
	{ memory: true },
)
