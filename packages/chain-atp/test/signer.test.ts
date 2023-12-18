import fs from "node:fs"
import { randomUUID } from "node:crypto"

import { ATPSigner, verifyLog } from "@canvas-js/chain-atp"

import test from "ava"

const plcOperationLog = JSON.parse(fs.readFileSync("test/plcOperationLog.json", "utf-8"))

test("create and verify session", async (t) => {
	const topic = "foobar"
	const signer = new ATPSigner()

	const address = "did:plc:uh3qgppih5ocj6hsvtlsg5v7"
	const signingKey = "did:key:zQ3shu1MQC5zxCcq67nDqyoCzkNyjzEWcy3D3sSkjyKL8ce9z"

	const verificationMethod = await verifyLog(address, plcOperationLog)
	const archives = {
		"test/archives/3kgtoieljuk2a.car": "at://did:plc:uh3qgppih5ocj6hsvtlsg5v7/app.bsky.feed.post/3kgtoieljuk2a",
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
