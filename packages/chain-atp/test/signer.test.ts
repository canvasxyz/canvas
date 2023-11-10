import fs from "node:fs"
import { randomUUID } from "node:crypto"

import { ATPSigner, verifyLog } from "@canvas-js/chain-atp"

import test from "ava"

const plcOperationLog = JSON.parse(fs.readFileSync("test/plcOperationLog.json", "utf-8"))

test("create and verify session", async (t) => {
	const topic = randomUUID()
	const signer = new ATPSigner()

	const address = "did:plc:mmftdzyl74ymn2hhzoahtjcw"
	const signingKey = "did:key:zQ3shWHru5nd9KVhuMsNTtN4QzAq2z7R22d7UKi7dtZAuZs2k"

	const verificationMethod = await verifyLog(address, plcOperationLog)
	const archives = {
		"test/archives/3kd4eokkt272u.car": "at://did:plc:mmftdzyl74ymn2hhzoahtjcw/app.bsky.feed.post/3kd4eokkt272u",
	}

	for (const [path, uri] of Object.entries(archives)) {
		const recordArchive = fs.readFileSync(path)
		await signer.verifySession(topic, {
			type: "session",

			address: address,
			publicKey: signingKey,

			authorizationData: {
				verificationMethod: verificationMethod,
				recordArchive,
				recordURI: uri,
				plcOperationLog: plcOperationLog,
			},

			timestamp: Date.now(),
			blockhash: null,
			duration: null,
		})
	}

	t.pass()
})
