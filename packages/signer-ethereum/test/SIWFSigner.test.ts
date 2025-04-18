import test from "ava"
import { ed25519 } from "@canvas-js/signatures"

import { SIWFSigner, validateSIWFSessionData } from "@canvas-js/signer-ethereum"
import { Action, Session } from "@canvas-js/interfaces"
import { SIWFSessionData } from "../src/siwf/types.js"
import { getBytes } from "ethers"

const exampleMessage = `6adf-66-65-178-244.ngrok-free.app wants you to sign in with your Ethereum account:
0x2bbaEe8900bb1664B1C83a3A4F142cDBF2224fb8

Farcaster Auth

URI: https://6adf-66-65-178-244.ngrok-free.app/login
Version: 1
Chain ID: 10
Nonce: Qi6dyWgDoxbhx8DBa
Issued At: 2025-01-21T21:51:55.722Z
Request ID: authorize:chat-example.canvas.xyz:did:key:z6MkqDpgypYLmKYiM6b3XXse4PN9AWELvFfbeoKXsa3tQGCe
Resources:
- farcaster://fid/144`

const exampleCustodyAddress = "0x2bbaEe8900bb1664B1C83a3A4F142cDBF2224fb8"
const exampleSignature =
	"0x454bc2f02140571af05a0a5842917163af1d638195add3b63617228d41e55b551ad78638194b2c2167db08e0060245b2a03cf2882bb8e651e666d9fcef70a7321c"
const exampleSignatureParams = {
	domain: "6adf-66-65-178-244.ngrok-free.app",
	nonce: "Qi6dyWgDoxbhx8DBa",
	requestId: "authorize:chat-example.canvas.xyz:did:key:z6MkqDpgypYLmKYiM6b3XXse4PN9AWELvFfbeoKXsa3tQGCe",
	siweUrl: "https://6adf-66-65-178-244.ngrok-free.app/login",
}

const exampleDelegatePrivateKey = "0x2fde6ea1538eb2f3a4f01849572307012df1b3d4e0ec4898bd5e2198099866e8"

test("create and verify session using external signature", async (t) => {
	const topic = "chat-example.canvas.xyz"

	// construct a requestId, which the user will pass to Farcaster to generate a SIWF message
	const requestId = await SIWFSigner.getSIWFRequestId(topic, exampleDelegatePrivateKey)
	t.is(requestId, exampleSignatureParams.requestId)

	// ... <use AuthKit to get a signed Sign in with Farcaster message> ...

	// parse the SIWF message returned from the Farcaster relay
	const {
		authorizationData,
		topic: parsedTopic,
		custodyAddress: parsedCustodyAddress,
	} = SIWFSigner.parseSIWFMessage(exampleMessage, exampleSignature)
	t.is(parsedTopic, topic)
	t.is(parsedCustodyAddress, exampleCustodyAddress)

	// validate the SIWF message matches data returned from the Farcaster relay
	t.is(authorizationData.siweDomain, exampleSignatureParams.domain)
	t.is(authorizationData.siweNonce, exampleSignatureParams.nonce)
	t.is(authorizationData.siweUri, exampleSignatureParams.siweUrl)

	// construct a SIWF signer
	const signer = new SIWFSigner({
		custodyAddress: exampleCustodyAddress,
		privateKey: exampleDelegatePrivateKey.slice(2),
	})

	// create a canvas session based on the SIWF message
	const timestamp = new Date(authorizationData.siweIssuedAt).valueOf()
	const { payload, signer: delegateSigner } = await signer.newSIWFSession(
		topic,
		authorizationData,
		timestamp,
		getBytes(exampleDelegatePrivateKey),
	)
	const session: Session<SIWFSessionData> = payload

	// verify the session
	t.notThrows(() => signer.verifySession(topic, session))

	// manually create and validate session message
	const sessionMessage = { topic, clock: 1, parents: [], payload: session }
	const sessionSignature = await delegateSigner.sign(sessionMessage)
	t.notThrows(() => ed25519.verify(sessionSignature, sessionMessage))

	// manually create and validate action message
	const action: Action = {
		type: "action",
		did: session.did,
		name: "foo",
		args: [7],
		context: {
			timestamp: session.context.timestamp,
		},
	}
	const actionMessage = { topic, clock: 1, parents: [], payload: action }
	const actionSignature = await delegateSigner.sign(actionMessage)
	t.notThrows(() => ed25519.verify(actionSignature, actionMessage))

	// creating or verifying a session with an invalid topic should fail
	const topic2 = "chat-example2.canvas.xyz"
	await t.throwsAsync(async () =>
		signer.newSIWFSession(topic2, authorizationData, timestamp, getBytes(exampleDelegatePrivateKey)),
	)
	await t.throwsAsync(async () => signer.verifySession(topic2, session))
})

test("reject invalid siwf message", async (t) => {
	const topic = "example:signer"
	const { authorizationData } = SIWFSigner.parseSIWFMessage(exampleMessage, exampleSignature)
	const timestamp = new Date(authorizationData.siweIssuedAt).valueOf()

	const signer = new SIWFSigner({
		custodyAddress: exampleCustodyAddress,
		privateKey: exampleDelegatePrivateKey.slice(2),
	})

	await t.throwsAsync(async () =>
		signer.newSIWFSession(topic, authorizationData, timestamp, getBytes(exampleDelegatePrivateKey)),
	)
})
