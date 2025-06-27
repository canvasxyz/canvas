import test from "ava"

import { ethers } from "ethers"
import { assert } from "@canvas-js/utils"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { Canvas, ModelSchema } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"

test("get a value set by another action", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
		static topic = "com.example.app"

		static models = {
			user: { id: "primary", name: "string" },
			post: { id: "primary", from: "@user", content: "string" },
		} satisfies ModelSchema

		async createUser({ name }: { name: string }) {
			const { did, db } = this
			await db.set("user", { id: did, name })
		}

		async createPost({ content }: { content: string }) {
			const { id, did, db } = this
			const user = await db.get("user", did)
			assert(user !== null)
			await db.set("post", { id, from: did, content })
		}

		async deletePost({ id }: { id: string }) {
			const { did, db } = this
			const post = await db.get("post", id)
			if (post !== null) {
				assert(post.from === did, "cannot delete others' posts")
				await db.delete("post", id)
			}
		}
	}

	const wallet = ethers.Wallet.createRandom()
	const app = await Canvas.initialize({
		signers: [new SIWESigner({ signer: wallet })],
		contract: MyApp,
	})

	t.teardown(() => app.stop())

	const { id } = await app.actions.createUser({ name: "John Doe" })
	t.log(`${id}: created user`)
	const { id: a } = await app.actions.createPost({ content: "foo" })
	t.log(`${a}: created post`)
	const { id: b } = await app.actions.createPost({ content: "bar" })
	t.log(`${b}: created post`)

	const compareIDs = ({ id: a }: { id: string }, { id: b }: { id: string }) => (a < b ? -1 : a === b ? 0 : 1)

	const results = await app.db.getAll<{ id: string; from: string; content: string }>("post")

	t.deepEqual(
		results.sort(compareIDs),
		[
			{ id: a, from: `did:pkh:eip155:1:${wallet.address}`, content: "foo" },
			{ id: b, from: `did:pkh:eip155:1:${wallet.address}`, content: "bar" },
		].sort(compareIDs),
	)
})
