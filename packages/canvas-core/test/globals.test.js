import test from "ava"

import { ethers } from "ethers"

import { getQuickJS } from "quickjs-emscripten"
import Hash from "ipfs-only-hash"

import { getActionSignatureData } from "@canvas-js/interfaces"
import { Core } from "../lib/index.js"

const quickJS = await getQuickJS()

const signer = new ethers.Wallet.createRandom()
const signerAddress = await signer.getAddress()

async function sign(signer, session, { spec, call, args }) {
	const timestamp = Date.now()
	const actionPayload = { from: signerAddress, spec, call, args, timestamp }
	const actionSignatureData = getActionSignatureData(actionPayload)
	const actionSignature = await signer._signTypedData(...actionSignatureData)
	return { payload: actionPayload, session, signature: actionSignature }
}

test("Test console.log", async (t) => {
	const spec = `
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

	const multihash = await Hash.of(spec)

	const core = await Core.initialize({ name: multihash, directory: null, spec: spec, quickJS })

	const action = await sign(signer, null, { spec: multihash, call: "newPost", args: ["Hello World"] })
	await core.apply(action)
	t.pass()
	await core.close()
})

test("Test fetch", async (t) => {
	const spec = `
export const models = {}
export const routes = {}
export const actions = {
  async logIP() {
    const res = await fetch("https://ipv4.icanhazip.com/")
    console.log("my IP address is", res)
  }
}
`.trim()

	const multihash = await Hash.of(spec)

	const core = await Core.initialize({ name: multihash, directory: null, spec: spec, quickJS })

	const action = await sign(signer, null, { spec: multihash, call: "logIP", args: [] })
	await core.apply(action)
	t.pass()
	await core.close()
})
