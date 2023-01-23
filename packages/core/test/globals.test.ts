import test from "ava"
import assert from "node:assert"

import { compileSpec, Core } from "@canvas-js/core"

import { TestSigner } from "./utils.js"

const { app, uri } = await compileSpec({
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

const signer = new TestSigner(uri)

test("test fetch() and log IP address", async (t) => {
	const core = await Core.initialize({ uri, app, directory: null, unchecked: true, offline: true })

	const action = await signer.sign("logIP", {})
	await t.notThrowsAsync(() => core.applyAction(action))

	await core.close()
})

test("test assert()", async (t) => {
	const core = await Core.initialize({ uri, app, directory: null, unchecked: true, offline: true })

	const successAction = await signer.sign("echo", { text: "hello world" })
	await t.notThrowsAsync(() => core.applyAction(successAction))

	const failureAction = await signer.sign("echo", { text: 5 })
	await t.throwsAsync(() => core.applyAction(failureAction), { message: "false == true" })

	await core.close()
})
