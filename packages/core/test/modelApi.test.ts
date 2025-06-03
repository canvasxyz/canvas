import { randomUUID } from "node:crypto"
import test, { ExecutionContext } from "ava"

import { ethers } from "ethers"
import { assert } from "@canvas-js/utils"

import type { Action, Message, Session } from "@canvas-js/interfaces"
import { ed25519 } from "@canvas-js/signatures"
import { SIWESigner, Eip712Signer } from "@canvas-js/signer-ethereum"
import { CosmosSigner } from "@canvas-js/signer-cosmos"
import { Canvas, ModelSchema } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"

test("get a value set by another action", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
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
		topic: "com.example.app",
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

test("merge and update into a value set by another action", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
		static models = {
			game: { id: "primary", state: "json", label: "string" },
		} satisfies ModelSchema

		async createGame() {
			await this.db.transaction(() =>
				this.db.set("game", {
					id: "0",
					state: { started: false, player1: "foo", player2: "bar" },
					label: "foobar",
				}),
			)
		}

		async updateGame() {
			await this.db.transaction(() =>
				this.db.merge("game", {
					id: "0",
					state: { started: true } as any,
					label: "foosball",
				}),
			)
		}

		async updateGameMultipleMerges() {
			await this.db.transaction(async () => {
				await this.db.merge("game", { id: "0", state: { extra1: { a: 1, b: 1 } } })
				await this.db.merge("game", { id: "0", state: { extra2: "b" } })
				await this.db.merge("game", { id: "0", state: { extra3: null, extra1: { b: 2, c: 3 } } })
			})
		}

		async updateGameMultipleUpdates() {
			await this.db.transaction(async () => {
				await this.db.update("game", { id: "0", state: { extra1: { a: 1, b: 2 } } })
				await this.db.update("game", { id: "0", state: { extra3: null, extra1: { b: 2, c: 3 } } })
			})
		}
	}

	const app = await Canvas.initialize({
		topic: "com.example.app",
		contract: MyApp,
	})

	t.teardown(() => app.stop())

	await app.actions.createGame()
	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		state: { started: false, player1: "foo", player2: "bar" },
		label: "foobar",
	})

	await app.actions.updateGame()
	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		state: { started: true, player1: "foo", player2: "bar" },
		label: "foosball",
	})

	await app.actions.updateGameMultipleMerges()
	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		state: {
			started: true,
			player1: "foo",
			player2: "bar",
			extra1: { a: 1, b: 2, c: 3 },
			extra2: "b",
			extra3: null,
		},
		label: "foosball",
	})

	await app.actions.updateGameMultipleUpdates()
	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		state: {
			extra3: null,
			extra1: { b: 2, c: 3 },
		},
		label: "foosball",
	})
})

test("merge and get execute in order", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
		static models = {
			test: { id: "primary", foo: "string?", bar: "string?", qux: "string?" },
		} satisfies ModelSchema

		async testMerges() {
			return await this.db.transaction(async () => {
				await this.db.set("test", { id: "0", foo: null, bar: null, qux: "foo" })
				await this.db.merge("test", { id: "0", foo: "foo", qux: "qux" })
				await this.db.merge("test", { id: "0", bar: "bar" })
				return await this.db.get("test", "0")
			})
		}

		async testGet(): Promise<any> {
			return await this.db.transaction(async () => {
				await this.db.set("test", { id: "1", foo: null, bar: null, qux: "foo" })
				const result = await this.db.get("test", "1")
				await this.db.merge("test", { id: "1", foo: "foo", qux: "qux" })
				await this.db.merge("test", { id: "1", bar: "bar" })
				return result
			})
		}
	}

	const app = await Canvas.initialize({
		topic: "com.example.app",
		contract: MyApp,
	})

	t.teardown(() => app.stop())

	await app.actions.testMerges()
	t.deepEqual(await app.db.get("test", "0"), {
		id: "0",
		foo: "foo",
		bar: "bar",
		qux: "qux",
	})

	const { result } = await app.actions.testGet()
	t.deepEqual(await app.db.get("test", "1"), {
		id: "1",
		foo: "foo",
		bar: "bar",
		qux: "qux",
	})
	t.deepEqual(result, {
		id: "1",
		foo: null,
		bar: null,
		qux: "foo",
	})
})