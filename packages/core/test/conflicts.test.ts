import test, { ExecutionContext } from "ava"
import * as cbor from "@ipld/dag-cbor"
import { Wallet } from "ethers"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Canvas } from "@canvas-js/core"
import { getRecordId } from "@canvas-js/core/utils"
import { assert } from "@canvas-js/utils"

const init = async (t: ExecutionContext) => {
	const signer = new SIWESigner({ signer: Wallet.createRandom() })
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
					assert(room !== null, "room does not exist")
					assert(this.did === room.admin_did, "not authorized to add members")
					await db.set("memberships", { id: `${roomId}/${did}` })
				},
				async removeMember(db, roomId, did) {
					const room = await db.get("rooms", roomId)
					assert(room !== null, "room does not exist")
					assert(did !== room.admin_did, "cannot remove the room admin")
					assert(this.did === did || this.did === room.admin_did, "not authorized to remove other members")
					await db.delete("memberships", `${roomId}/${did}`)
				},
				async createPost(db, roomId, content) {
					const postId = [this.did, this.id].join("/")
					const membership = await db.get("memberships", `${roomId}/${this.did}`)
					assert(membership !== null, "not a member")
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

test("create a room and post a message", async (t) => {
	const { app } = await init(t)

	const createRoom = await app.actions.createRoom()
	t.log(`applied createRoom ${createRoom.id}`)
	const roomId = createRoom.id
	const adminDid = createRoom.message.payload.did
	const membershipId = `${roomId}/${adminDid}`
	Promise.resolve(app.db.get("rooms", roomId)).then((room) => t.is(room?.admin_did, adminDid))
	Promise.resolve(app.db.get("memberships", membershipId)).then((membership) => t.not(membership, null))

	const createPost1 = await app.actions.createPost(roomId, "hello")
	t.log(`applied createPost1 ${createPost1.id}`)

	const postId = [createPost1.message.payload.did, createPost1.id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello")

	const roomRecordId = getRecordId("rooms", roomId)
	const membershipRecordId = getRecordId("memberships", membershipId)
	const postRecordId = getRecordId("posts", postId)

	t.log("roomRecordId", roomRecordId)
	t.log("membershipRecordId", membershipRecordId)
	t.log("postRecordId", postRecordId)

	t.deepEqual(
		await app.db.query("$writes", { orderBy: { key: "asc" } }),
		[
			{
				key: `${roomRecordId}:${createRoom.id}`,
				version: createRoom.id,
				value: new Uint8Array(cbor.encode({ id: createRoom.id, admin_did: createRoom.message.payload.did })),
				reverted: false,
			},
			{
				key: `${membershipRecordId}:${createRoom.id}`,
				version: createRoom.id,
				value: new Uint8Array(cbor.encode({ id: `${roomId}/${adminDid}` })),
				reverted: false,
			},
			{
				key: `${postRecordId}:${createPost1.id}`,
				version: createPost1.id,
				value: new Uint8Array(cbor.encode({ id: postId, room_id: roomId, content: "hello" })),
				reverted: false,
			},
		].sort((a, b) => (a.key < b.key ? -1 : 1)),
	)

	t.deepEqual(await app.db.query("$reads"), [
		{
			key: `${membershipRecordId}:${createPost1.id}`,
			version: createRoom.id,
		},
	])

	t.deepEqual(
		await app.db.query("$records", { orderBy: { id: "asc" } }),
		[
			{ id: roomRecordId, model: "rooms", key: roomId },
			{ id: membershipRecordId, model: "memberships", key: membershipId },
			{ id: postRecordId, model: "posts", key: postId },
		].sort((a, b) => (a.id < b.id ? -1 : 1)),
	)
})

test("create a room and add two members concurrently", async (t) => {
	const { app: app1, signer: signer1 } = await init(t)
	const { app: app2, signer: signer2 } = await init(t)
	const { app: app3, signer: signer3 } = await init(t)
	const did1 = await signer1.getDid()
	const did2 = await signer2.getDid()
	const did3 = await signer3.getDid()
	t.log("signer1 did:", did1)
	t.log("signer2 did:", did2)
	t.log("signer3 did:", did3)

	const createRoom = await app1.actions.createRoom()
	t.log(`applied createRoom ${createRoom.id}`)
	const roomId = createRoom.result
	const adminDid = createRoom.message.payload.did

	await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))
	await app1.messageLog.serve((snapshot) => app3.messageLog.sync(snapshot))

	await app2.as(signer1).addMember(roomId, await signer2.getDid())
	await app3.as(signer1).addMember(roomId, await signer3.getDid())

	await app2.actions.createPost(roomId, "hello")
	await app3.actions.createPost(roomId, "world")

	t.pass()
})

test("create a room and add the same member twice concurrently (write-write conflict)", async (t) => {
	const alice = new SIWESigner({ signer: Wallet.createRandom() })
	const aliceDid = await alice.getDid()

	const { app: app1, signer: signer1 } = await init(t)
	const { app: app2, signer: signer2 } = await init(t)
	const { app: app3, signer: signer3 } = await init(t)
	const did1 = await signer1.getDid()
	const did2 = await signer2.getDid()
	const did3 = await signer3.getDid()
	t.log("signer1 did:", did1)
	t.log("signer2 did:", did2)
	t.log("signer3 did:", did3)

	const createRoom = await app1.actions.createRoom()
	t.log(`applied createRoom ${createRoom.id}`)
	const roomId = createRoom.result
	const adminDid = createRoom.message.payload.did

	await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))
	await app1.messageLog.serve((snapshot) => app3.messageLog.sync(snapshot))

	await app2.as(signer1).addMember(roomId, aliceDid)
	await app3.as(signer1).addMember(roomId, aliceDid)

	// okay now we have conflicting writes to the memberships table
	await app2.messageLog.serve((snapshot) => app3.messageLog.sync(snapshot))
	await app3.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))

	t.pass()
})

test("concurrently post and remove a member (read-write conflict)", async (t) => {
	const alice = new SIWESigner({ signer: Wallet.createRandom() })
	const aliceDid = await alice.getDid()

	const { app: app1, signer: signer1 } = await init(t)
	const { app: app2, signer: signer2 } = await init(t)
	const { app: app3, signer: signer3 } = await init(t)
	const did1 = await signer1.getDid()
	const did2 = await signer2.getDid()
	const did3 = await signer3.getDid()
	t.log("signer1 did:", did1)
	t.log("signer2 did:", did2)
	t.log("signer3 did:", did3)

	const createRoom = await app1.actions.createRoom()
	t.log(`applied createRoom ${createRoom.id}`)
	const roomId = createRoom.result

	await app1.actions.addMember(roomId, aliceDid)

	await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))
	await app1.messageLog.serve((snapshot) => app3.messageLog.sync(snapshot))

	await app2.as(signer1).removeMember(roomId, aliceDid)
	await app3.as(alice).createPost(roomId, "HELLO WORLD")

	// okay now we have read-write conflict between createPost and removeMember
	await app2.messageLog.serve((snapshot) => app3.messageLog.sync(snapshot))
	await app3.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))

	t.pass()
})
