import test from "ava"
import assert from "assert"
import * as siwe from "siwe"

import { Wallet } from "ethers"

import { ed25519 } from "@canvas-js/signatures"

import { SIWFSigner, validateSIWFSessionData } from "@canvas-js/chain-ethereum"
import { Action, Session } from "@canvas-js/interfaces"
import { SIWFSessionData } from "../src/siwf/types.js"
import { getBytes } from "ethers"

const exampleMessage = `6adf-66-65-178-244.ngrok-free.app wants you to sign in with your Ethereum account:
0x2bbaEe8900bb1664B1C83a3A4F142cDBF2224fb8

Farcaster Auth

URI: https://6adf-66-65-178-244.ngrok-free.app/login
Version: 1
Chain ID: 10
Nonce: nKywRPbIhH4Ag2VKU
Issued At: 2025-01-21T06:29:43.193Z
Request ID: authorize:chat-example.canvas.xyz:0x7BB1d757aDd763d2843a6EAA519600B3D6a34d02
Resources:
- farcaster://fid/144`

const exampleSignature =
	"0xa14a23c25fbb469fba718a938402cdc2d564a8395b752afd554bdc022769a2c65168612251f0165cd91ca8d81749713d31e561aceb77f629fb73927c2e7bbd8c1c"
const exampleSignatureParams = {
	domain: "6adf-66-65-178-244.ngrok-free.app",
	nonce: "nKywRPbIhH4Ag2VKU",
	requestId: "authorize:chat-example.canvas.xyz:0x7BB1d757aDd763d2843a6EAA519600B3D6a34d02",
	siweUrl: "https://6adf-66-65-178-244.ngrok-free.app/login",
}

const exampleDelegatePrivateKey = "caeffb4a15b98aacd214d3093eedf43aff5efd73f67d2b1bfd40f0f729075bd4"

test("create and verify session using external signature", async (t) => {
	const topic = "chat-example.canvas.xyz"

	// construct a SIWF signer
	const signer = new SIWFSigner({ signer: new Wallet(exampleDelegatePrivateKey) })

	// construct a requestId, which the user will pass to Farcaster to generate a SIWF message
	const requestId = await signer.getSIWFRequestId(topic)
	t.is(requestId, "authorize:chat-example.canvas.xyz:0x7BB1d757aDd763d2843a6EAA519600B3D6a34d02")

	// ... <use AuthKit to get a signed Sign in with Farcaster message> ...

	// parse the SIWF message returned from the Farcaster relay
	const [authorizationData, parsedTopic, parsedCustodyAddress] = signer.parseSIWFMessage(exampleMessage, exampleSignature)

	// validate the SIWF message matches data returned from the Farcaster relay
	t.is(authorizationData.siweDomain, exampleSignatureParams.domain)
	t.is(authorizationData.siweNonce, exampleSignatureParams.nonce)
	t.is(authorizationData.siweUri, exampleSignatureParams.siweUrl)
	t.is(requestId, exampleSignatureParams.requestId)

	// create a canvas session based on the SIWF message
	const timestamp = new Date(authorizationData.siweIssuedAt).valueOf()
	const { payload, signer: delegateSigner } = await signer.newSession(topic, authorizationData, timestamp)
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
	await t.throwsAsync(async () => signer.newSession(topic2, authorizationData, timestamp))
	await t.throwsAsync(async () => signer.verifySession(topic2, session))
})

test("reject invalid siwf message", async (t) => {
	const topic = "example:signer"
	const signer = new SIWFSigner({ signer: new Wallet(exampleDelegatePrivateKey) })
	const [authorizationData] = signer.parseSIWFMessage(exampleMessage, exampleSignature)
	const timestamp = new Date(authorizationData.siweIssuedAt).valueOf()

	await t.throwsAsync(async () => signer.newSession(topic, authorizationData, timestamp))	
})
