import test, { ExecutionContext } from "ava"
import * as cbor from "@ipld/dag-cbor"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Canvas } from "@canvas-js/core"
import { getRecordId } from "@canvas-js/core/utils"
import { assert } from "@canvas-js/utils"

const init = async (t: ExecutionContext) => {
	const signer = new SIWESigner()
	const app = await Canvas.initialize({
		contract: {
			models: {
				rooms: { id: "primary", admin_did: "string" },
				posts: { id: "primary", room_id: "string", content: "string" },
				memberships: { id: "primary" }, // `${room.id}/${did}`
			},
			actions: {
				async createRoom(db) {
					await db.set("rooms", { id: this.id, admin_did: this.did })
					await db.set("memberships", { id: `${this.id}/${this.did}` })
					return this.id
				},
				async addMember(db, roomId, did) {
					const room = await db.get("rooms", roomId)
					assert(room !== null && room.admin_did === this.did)
					await db.set("memberships", { id: `${roomId}/${did}` })
				},
				async createPost(db, roomId, content) {
					const postId = [this.did, this.id].join("/")
					await db.get("memberships", `${roomId}/${this.did}`).then(assert)
					await db.set("posts", { id: postId, room_id: roomId, content })
				},
			},
		},
		topic: "com.example.app",
		reset: true,
		signers: [signer],
	})

	t.teardown(() => app.stop())
	return { app, signer }
}

test("create a record", async (t) => {
	const { app } = await init(t)

	const createRoom = await app.actions.createRoom()
	t.log(`applied createRoom ${createRoom.id}`)
	const roomId = createRoom.result
	const adminDid = createRoom.message.payload.did
	const room = await app.db.get("rooms", roomId)
	t.is(room?.admin_did, adminDid)

	const createPost1 = await app.actions.createPost(roomId, "hello")
	t.log(`applied createPost1 ${createPost1.id}`)

	const postId = [createPost1.message.payload.did, createPost1.id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello")

	const roomRecordId = getRecordId("rooms", roomId)
	const membershipRecordKey = `${roomId}/${adminDid}`
	const membershipRecordId = getRecordId("memberships", membershipRecordKey)
	const postRecordId = getRecordId("posts", postId)

	t.log("roomRecordId", roomRecordId)
	t.log("membershipRecordId", membershipRecordId)
	t.log("postRecordId", postRecordId)

	t.deepEqual(
		await app.db.query("$writes", { orderBy: { key: "asc" } }),
		[
			{
				key: `${roomRecordId}/${createRoom.id}`,
				record_model: "rooms",
				record_key: roomId,
				record_version: createRoom.id,
				value: new Uint8Array(cbor.encode({ id: createRoom.id, admin_did: createRoom.message.payload.did })),
				reverted: false,
			},
			{
				key: `${membershipRecordId}/${createRoom.id}`,
				record_model: "memberships",
				record_key: membershipRecordKey,
				record_version: createRoom.id,
				value: new Uint8Array(cbor.encode({ id: `${roomId}/${adminDid}` })),
				reverted: false,
			},
			{
				key: `${postRecordId}/${createPost1.id}`,
				record_model: "posts",
				record_key: postId,
				record_version: createPost1.id,
				value: new Uint8Array(cbor.encode({ id: postId, room_id: roomId, content: "hello" })),
				reverted: false,
			},
		].sort((a, b) => (a.key < b.key ? -1 : 1)),
	)

	t.deepEqual(await app.db.query("$reads"), [
		{
			key: `${membershipRecordId}/${createPost1.id}`,
			version: createRoom.id,
		},
	])
})
