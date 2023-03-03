import test from "ava"
import assert from "node:assert"

import { Core } from "@canvas-js/core"

import { TestSigner, compileSpec } from "./utils.js"

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
	const core = await Core.initialize({ uri: app, spec, directory: null, offline: true, unchecked: true })

	const action = await signer.sign("logIP", {})
	await t.notThrowsAsync(() => core.apply(action))

	await core.close()
})

test("test assert()", async (t) => {
	const core = await Core.initialize({ uri: app, spec, directory: null, offline: true, unchecked: true })

	const successAction = await signer.sign("echo", { text: "hello world" })
	await t.notThrowsAsync(() => core.apply(successAction))

	const failureAction = await signer.sign("echo", { text: 5 })
	await t.throwsAsync(() => core.apply(failureAction), { message: "false == true" })

	await core.close()
})
