import test from "ava"
import assert from "assert"

import { ed25519 } from "@canvas-js/signatures"

import { SIWFSigner, validateSIWFSessionData } from "@canvas-js/chain-ethereum"
import { Action, Session } from "@canvas-js/interfaces"
import { SIWFSessionData } from "../src/siwf/types.js"
import { getBytes } from "ethers"

test("create and verify session using external signature", async (t) => {
	const topic = "SXUqZCnWLY0mwBCIwqCy86PFL56rXmPY"
	const signer = new SIWFSigner()

	const farcasterSignerAddress = "0xf0d7b86B8DAEA35903e5ecb1C90dFAc41CBEC9DF"

	const authorizationData: SIWFSessionData = {
		signature: getBytes(
			"0x22f2f6076df82f3bc78d2b0a1e79112511571278d785c7df6b25cda668c5bcae410890c728796a15da5fd1b70572b1cb6f02fc22fa502e79a200affd88d772c71b",
		),
		domain: "immune-haddock-completely.ngrok-free.app",
		farcasterSignerAddress,
		// siweVersion: "1",
		// siwfChainId: "10",
		canvasNonce: "SXUqZCnWLY0mwBCIwqCy86PFL56rXmPY", // topic
		fid: "773313",
		issuedAt: "2025-01-17T16:10:11.563Z",
		expirationTime: "2025-01-17T16:20:11.551Z",
		notBefore: "2025-01-17T16:10:11.551Z",
	}
	const timestamp = new Date(authorizationData.issuedAt).valueOf()

	const { payload, signer: delegateSigner } = await signer.newSession(topic, authorizationData, timestamp)
	const session: Session<SIWFSessionData> = payload
	t.notThrows(() => signer.verifySession(topic, session))

	const sessionMessage = { topic, clock: 1, parents: [], payload: session }
	const sessionSignature = await delegateSigner.sign(sessionMessage)
	t.notThrows(() => ed25519.verify(sessionSignature, sessionMessage))
})

// test("create and verify session and action", async (t) => {
// 	const topic = "example:signer"
// 	const signer = new SIWFSigner()
// 	const { payload: session, signer: delegateSigner } = await signer.newSession(topic)
// 	t.notThrows(() => signer.verifySession(topic, session))

// 	const sessionMessage = { topic, clock: 1, parents: [], payload: session }
// 	const sessionSignature = await delegateSigner.sign(sessionMessage)
// 	t.notThrows(() => ed25519.verify(sessionSignature, sessionMessage))

// 	const action: Action = {
// 		type: "action",
// 		did: session.did,
// 		name: "foo",
// 		args: [7],
// 		context: {
// 			timestamp: session.context.timestamp,
// 		},
// 	}

// 	const actionMessage = { topic, clock: 1, parents: [], payload: action }
// 	const actionSignature = await delegateSigner.sign(actionMessage)
// 	t.notThrows(() => ed25519.verify(actionSignature, actionMessage))
// })

// test("reject corrupt session signature", async (t) => {
// 	const topic = "example:signer"
// 	const signer = new SIWFSigner()
// 	const { payload: session } = await signer.newSession(topic)
// 	// corrupt the session signature
// 	session.authorizationData.signature[0] = 1
// 	assert(validateSIWFSessionData(session.authorizationData))
// 	session.authorizationData.signature[3] = 1
// 	await t.throwsAsync(async () => signer.verifySession(topic, session))
// })

// test("reject session signature for wrong topic", async (t) => {
// 	const topic = "example:signer"
// 	const topic2 = "example:signer2"
// 	const signer = new SIWFSigner()
// 	const { payload: session } = await signer.newSession(topic)
// 	const { payload: session2 } = await signer.newSession(topic2)

// 	await t.throwsAsync(async () => signer.verifySession(topic, session2))
// })
