import test from "ava"

import { compileSpec, Core } from "@canvas-js/core"

import { TestSigner } from "./utils.js"

const { spec, uri } = await compileSpec({
	models: {},
	actions: {
		async logIP() {
			const res = await fetch("https://ipv4.icanhazip.com/")
			console.log("my IP address is", res)
		},
	},
})

const signer = new TestSigner(uri)

test("test fetch and log IP address", async (t) => {
	const core = await Core.initialize({ uri, spec, directory: null, unchecked: true, offline: true })

	const action = await signer.sign("logIP", {})
	await core.applyAction(action)
	await core.close()

	t.pass()
})
