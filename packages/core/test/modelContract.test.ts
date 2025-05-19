import test from "ava"

import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { Canvas, ModelSchema } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"

test("create, update, and delete in an inline contract with $rules", async (t) => {
	const wallet = ethers.Wallet.createRandom()

	const app = await Canvas.initialize({
		topic: "example.xyz",
		contract: {
			models: {
				posts: {
					$primary: "pk",
					pk: "string",
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

	await app.create("posts", { pk: "foo", address: `did:pkh:eip155:1:${wallet.address}`, content: "Hello world" })
	await t.throwsAsync(async () => {
		await app.create("posts", { pk: "foo", address: `did:pkh:eip155:1:${ethers.Wallet.createRandom().address}` })
	})

	const value = await app.db.get("posts", "foo")
	t.is(value?.address, `did:pkh:eip155:1:${wallet.address}`)
	t.is(value?.content, "Hello world")

	await t.throwsAsync(async () => {
		await app.update("posts", { pk: "foo", address: `did:pkh:eip155:1:${ethers.Wallet.createRandom().address}` })
	})
	await app.update("posts", { pk: "foo", address: `did:pkh:eip155:1:${wallet.address}`, content: "Bonk!" })
	const value2 = await app.db.get("posts", "foo")
	t.is(value2?.content, "Bonk!")

	await t.throwsAsync(async () => {
		await app.delete("posts", "foo")
	})
})

test("create, update, and delete in a string contract with $rules", async (t) => {
	const wallet = ethers.Wallet.createRandom()

	const app = await Canvas.initialize({
		topic: "example.xyz",
		contract: `
		export default class {
		  static models = {
        posts: {
          $primary: "pk",
          pk: "string",
          address: "string",
          content: "string",
          $rules: {
            create: "address === this.did",
            update: "address === this.did",
            delete: false,
          }
        }
			}
		}`,
		signers: [new SIWESigner({ signer: wallet })],
	})
	t.teardown(() => app.stop())

	await app.create("posts", { pk: "foo", address: `did:pkh:eip155:1:${wallet.address}`, content: "Hello world" })
	await t.throwsAsync(async () => {
		await app.create("posts", { pk: "foo", address: `did:pkh:eip155:1:${ethers.Wallet.createRandom().address}` })
	})

	const value = await app.db.get("posts", "foo")
	t.is(value?.address, `did:pkh:eip155:1:${wallet.address}`)
	t.is(value?.content, "Hello world")

	await t.throwsAsync(async () => {
		await app.update("posts", { pk: "foo", address: `did:pkh:eip155:1:${ethers.Wallet.createRandom().address}` })
	})
	await app.update("posts", { pk: "foo", address: `did:pkh:eip155:1:${wallet.address}`, content: "Bonk!" })
	const value2 = await app.db.get("posts", "foo")
	t.is(value2?.content, "Bonk!")

	await t.throwsAsync(async () => {
		await app.delete("posts", "foo")
	})
})
