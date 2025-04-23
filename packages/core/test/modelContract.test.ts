import test from "ava"

import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { Canvas } from "@canvas-js/core"

test("create, update, and delete in a contract permissioned by model $rules", async (t) => {
	const wallet = ethers.Wallet.createRandom()

	const app = await Canvas.initialize({
		topic: "example.xyz",
		contract: {
			models: {
				posts: {
					id: "primary",
					address: "string",
					content: "string",
					$rules: {
						create: "address === this.did",
						update: "address === this.did",
						delete: false,
					},
				},
			},
		},
		signers: [new SIWESigner({ signer: wallet })],
	})
	t.teardown(() => app.stop())

	await app.actions.createPosts({ id: "foo", address: `did:pkh:eip155:1:${wallet.address}`, content: "Hello world" })
	await t.throwsAsync(async () => {
		await app.actions.createPosts({ id: "foo", address: `did:pkh:eip155:1:${ethers.Wallet.createRandom().address}` })
	})

	const value = await app.db.get("posts", "foo")
	t.is(value?.address, `did:pkh:eip155:1:${wallet.address}`)
	t.is(value?.content, "Hello world")

	await t.throwsAsync(async () => {
		await app.actions.updatePosts({ id: "foo", address: `did:pkh:eip155:1:${ethers.Wallet.createRandom().address}` })
	})
	await app.actions.updatePosts({ id: "foo", address: `did:pkh:eip155:1:${wallet.address}`, content: "Bonk!" })
	const value2 = await app.db.get("posts", "foo")
	t.is(value2?.content, "Bonk!")

	await t.throwsAsync(async () => {
		await app.actions.deletePosts("foo")
	})
})
