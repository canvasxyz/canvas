import fs from "node:fs"

import { ATPSigner, verifyLog } from "@canvas-js/chain-atp"

import test from "ava"

const { topic, did, signingKey, archives } = JSON.parse(fs.readFileSync("test/fixture.json", "utf-8"))

const plcOperationLog = JSON.parse(fs.readFileSync("test/plcOperationLog.json", "utf-8"))

test("create and verify session", async (t) => {
	const signer = new ATPSigner()

	const verificationMethod = await verifyLog(did, plcOperationLog)

	for (const [path, uri] of Object.entries(archives)) {
		const recordArchive = fs.readFileSync(path)
		await signer.verifySession(topic, {
			type: "session",

			did: did,
			publicKey: signingKey,

			authorizationData: {
				verificationMethod: verificationMethod,
				recordArchive,
				recordURI: uri as string,
				plcOperationLog: plcOperationLog,
			},

			context: {
				timestamp: Date.now(),
			},
		})
	}

	t.pass()
})
