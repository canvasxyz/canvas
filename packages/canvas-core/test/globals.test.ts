import test from "ava"

import { ethers } from "ethers"

import { getQuickJS } from "quickjs-emscripten"

import { ActionArgument, getActionSignatureData } from "@canvas-js/interfaces"
import { Core } from "@canvas-js/core"

const quickJS = await getQuickJS()

const signer = ethers.Wallet.createRandom()
const signerAddress = await signer.getAddress()

const specName = "spec.js"

async function sign(signer: ethers.Wallet, session: string | null, call: string, args: ActionArgument[]) {
	const timestamp = Date.now()
	const actionPayload = { from: signerAddress, spec: specName, call, args, timestamp }
	const actionSignatureData = getActionSignatureData(actionPayload)
	const actionSignature = await signer._signTypedData(...actionSignatureData)
	return { payload: actionPayload, session, signature: actionSignature }
}

const config = { development: true, unchecked: true, databaseURI: null }

test("Test console.log", async (t) => {
	const spec = `
export const database = "sqlite"
export const models = {
  posts: { content: "string" }
}
export const routes = {}
export const actions = {
  async newPost(content) {
    console.log("cool!", this.hash)
    this.db.posts.set(this.hash, { content })
    await new Promise((resolve, reject) => {
      console.log("neat")
      resolve()
    })
  }
}
`.trim()

	const core = await Core.initialize({ name: specName, spec: spec, quickJS, ...config })

	const action = await sign(signer, null, "newPost", ["Hello World"])
	await core.apply(action)
	await core.close()
	t.pass()
})

test("Test fetch", async (t) => {
	const spec = `
export const database = "sqlite"
export const models = {}
export const routes = {}
export const actions = {
  async logIP() {
    const res = await fetch("https://ipv4.icanhazip.com/")
    console.log("my IP address is", res)
  }
}
`.trim()

	const core = await Core.initialize({ name: specName, spec: spec, quickJS, ...config })

	const action = await sign(signer, null, "logIP", [])
	await core.apply(action)
	await core.close()
	t.pass()
})
