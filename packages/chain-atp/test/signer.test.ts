import fs from "node:fs"

import { ATPSigner, parseVerificationMethod, verifyLog } from "@canvas-js/chain-atp"

import test from "ava"

const plcOperationLog = JSON.parse(fs.readFileSync("test/plcOperationLog.json", "utf-8"))

test("create and verify session", async (t) => {
	const signer = new ATPSigner()

	const [_, publicKey] = parseVerificationMethod("did:key:zQ3shWHru5nd9KVhuMsNTtN4QzAq2z7R22d7UKi7dtZAuZs2k")

	const did = "did:plc:mmftdzyl74ymn2hhzoahtjcw"
	const verificationMethod = await verifyLog(did, plcOperationLog)
	const archives = {
		"test/archives/3kd4eokkt272u.car": "at://did:plc:mmftdzyl74ymn2hhzoahtjcw/app.bsky.feed.post/3kd4eokkt272u",
	}

	for (const [path, uri] of Object.entries(archives)) {
		const recordArchive = fs.readFileSync(path)
		await signer.verifySession({
			type: "session",
			address: did,

			publicKeyType: "secp256k1",
			publicKey: publicKey,

			data: {
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
