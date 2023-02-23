import test from "ava"
import assert from "node:assert"

import { compileSpec, Core } from "@canvas-js/core"

import { TestSigner } from "./utils.js"

const { spec, app, appName } = await compileSpec({
	name: "Test App",
	models: {},
	actions: {
		async logIP() {
			const res = await fetch("https://ipv4.icanhazip.com/")
			console.log("my IP address is", res)
		},

		async echo({ text }) {
			assert(typeof text === "string")
			console.log(text)
		},
	},
})

const signer = new TestSigner(app, appName)

test("test fetch() and log IP address", async (t) => {
	const core = await Core.initialize({ uri: app, spec, directory: null, libp2p: null, unchecked: true })

	const action = await signer.sign("logIP", {})
	await t.notThrowsAsync(() => core.applyAction(action))

	await core.close()
})

test("test assert()", async (t) => {
	const core = await Core.initialize({ uri: app, spec, directory: null, libp2p: null, unchecked: true })

	const successAction = await signer.sign("echo", { text: "hello world" })
	await t.notThrowsAsync(() => core.applyAction(successAction))

	const failureAction = await signer.sign("echo", { text: 5 })
	await t.throwsAsync(() => core.applyAction(failureAction), { message: "false == true" })

	await core.close()
})
