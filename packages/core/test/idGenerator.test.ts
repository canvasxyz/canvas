import test from "ava"

import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"
import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { Canvas, ModelSchema } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"
import { encodeId } from "@canvas-js/gossiplog"

const hashN = (id: string, n: number): string => {
	let result = encodeId(id)
	for (let i = 0; i < n; i++) {
		result = sha256(result)
	}
	return bytesToHex(result).slice(0, 32)
}

test("create several ids", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
		static models = {
			blobs: { id: "primary", txid: "string" },
		} satisfies ModelSchema

		async createBlob() {
			await this.db.set("blobs", { id: this.db.id(), txid: this.id })
			return this.id
		}
		async createSeveralBlobs() {
			await this.db.set("blobs", { id: this.db.id(), txid: this.id })
			await this.db.set("blobs", { id: this.db.id(), txid: this.id })
			await this.db.set("blobs", { id: this.db.id(), txid: this.id })
			return this.id
		}
		async createSeveralBlobsInterleaved() {
			await this.db.set("blobs", { id: this.db.id(), txid: this.id })
			this.db.id()
			await this.db.set("blobs", { id: this.db.id(), txid: this.id })
			this.db.id()
			await this.db.set("blobs", { id: this.db.id(), txid: this.id })
			this.db.id()
			return this.id
		}
	}

	const wallet = ethers.Wallet.createRandom()
	const app = await Canvas.initialize({
		topic: "example.xyz",
		contract: MyApp,
		signers: [new SIWESigner({ signer: wallet })],
	})
	t.teardown(() => app.stop())

	const { result: id1 } = await app.actions.createBlob()
	t.deepEqual(await app.db.query("blobs"), [{ id: hashN(id1, 1), txid: id1 }])

	const { result: id2 } = await app.actions.createSeveralBlobs()
	t.deepEqual(await app.db.query("blobs"), [
		{ id: hashN(id1, 1), txid: id1 },
		{ id: hashN(id2, 1), txid: id2 },
		{ id: hashN(id2, 2), txid: id2 },
		{ id: hashN(id2, 3), txid: id2 },
	])

	const { result: id3 } = await app.actions.createSeveralBlobsInterleaved()
	t.deepEqual(await app.db.query("blobs"), [
		{ id: hashN(id1, 1), txid: id1 },
		{ id: hashN(id2, 1), txid: id2 },
		{ id: hashN(id2, 2), txid: id2 },
		{ id: hashN(id2, 3), txid: id2 },
		{ id: hashN(id3, 1), txid: id3 },
		{ id: hashN(id3, 3), txid: id3 },
		{ id: hashN(id3, 5), txid: id3 },
	])
})

test("create several ids in a string contract", async (t) => {
	const wallet = ethers.Wallet.createRandom()

	const app = await Canvas.initialize({
		topic: "example.xyz",
		contract: `
export const models = {
  blobs: { id: "primary", txid: "string" },
}

export const actions = {
	async createBlob() {
		await this.db.set("blobs", { id: this.db.id(), txid: this.id })
		return this.id
	},
	async createSeveralBlobs() {
		await this.db.set("blobs", { id: this.db.id(), txid: this.id })
		await this.db.set("blobs", { id: this.db.id(), txid: this.id })
		await this.db.set("blobs", { id: this.db.id(), txid: this.id })
		return this.id
	},
	async createSeveralBlobsInterleaved() {
		await this.db.set("blobs", { id: this.db.id(), txid: this.id })
		this.db.id()
		await this.db.set("blobs", { id: this.db.id(), txid: this.id })
		this.db.id()
		await this.db.set("blobs", { id: this.db.id(), txid: this.id })
		this.db.id()
		return this.id
	},
}`,
		signers: [new SIWESigner({ signer: wallet })],
	})
	t.teardown(() => app.stop())

	const { result: id1 } = await app.actions.createBlob()
	t.deepEqual(await app.db.query("blobs"), [{ id: hashN(id1, 1), txid: id1 }])

	const { result: id2 } = await app.actions.createSeveralBlobs()
	t.deepEqual(await app.db.query("blobs"), [
		{ id: hashN(id1, 1), txid: id1 },
		{ id: hashN(id2, 1), txid: id2 },
		{ id: hashN(id2, 2), txid: id2 },
		{ id: hashN(id2, 3), txid: id2 },
	])

	const { result: id3 } = await app.actions.createSeveralBlobsInterleaved()
	t.deepEqual(await app.db.query("blobs"), [
		{ id: hashN(id1, 1), txid: id1 },
		{ id: hashN(id2, 1), txid: id2 },
		{ id: hashN(id2, 2), txid: id2 },
		{ id: hashN(id2, 3), txid: id2 },
		{ id: hashN(id3, 1), txid: id3 },
		{ id: hashN(id3, 3), txid: id3 },
		{ id: hashN(id3, 5), txid: id3 },
	])
})
