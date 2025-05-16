import test from "ava"
import Refs from "./refs.js"

import { Canvas, DeriveModelTypes } from "@canvas-js/core"

type Models = DeriveModelTypes<typeof Refs.models>

const getApp = async () => {
	const app = await Canvas.initialize({
		contract: Refs,
		topic: "refs.nyc.test",
	})
	const did = await app.signers.getFirst().getDid()

	const newProfile: Models["profile"] = {
		// id: "user123",
		id: did,
		userName: "testuser",
		firstName: "Test",
		lastName: "User",
		geolocation: null,
		location: null,
		image: null,
		created: null,
		updated: null,
	}

	const newRef: Omit<Models["ref"], "id"> = {
		creator: did,
		type: "place",
		title: "Test Place",
		image: null,
		location: "New York",
		url: null,
		meta: null,
		created: new Date().toISOString(),
		updated: null,
		deleted: null,
	}

	const getNewConnection = (refId: string) => {
		const newConnection: Models["connection"] = {
			id: `${did}/${refId}`,
			creator: did,
			ref: refId,
			image: null,
			location: null,
			url: null,
			text: "This is a test connection",
			children: [],
			list: true,
			backlog: false,
			order: 1,
			created: new Date().toISOString(),
			deleted: null,
			updated: null,
		}
		return newConnection
	}

	return { app, did, newProfile, newRef, getNewConnection }
}

test("can create and update your profile", async (t) => {
	const { app, newProfile } = await getApp()

	await app.create("profile", newProfile)
	t.deepEqual(await app.db.query("profile"), [newProfile])

	const updatedProfile = { ...newProfile, location: "San Francisco, CA" }
	await app.update("profile", updatedProfile)
	t.deepEqual(await app.db.query("profile"), [updatedProfile])
})

test("cannot create or update someone else's profile", async (t) => {
	const { app, newProfile } = await getApp()

	await app.create("profile", newProfile)
	t.deepEqual(await app.db.query("profile"), [newProfile])

	await t.throwsAsync(async () => await app.create("profile", { ...newProfile, id: "did:fake" }))
	t.deepEqual(await app.db.query("profile"), [newProfile])

	await t.throwsAsync(async () => await app.update("profile", { ...newProfile, id: "did:fake" }))
	t.deepEqual(await app.db.query("profile"), [newProfile])
})

test("can create and update refs and connections", async (t) => {
	const { app, newProfile, newRef, getNewConnection } = await getApp()

	await app.create("profile", newProfile)
	t.deepEqual(await app.db.query("profile"), [newProfile])

	const { id: refId } = await app.create("ref", newRef)
	const [{ id, ...ref }] = await app.db.query("ref")
	t.deepEqual(ref, newRef)

	const newConnection = getNewConnection(refId)
	await app.create("connection", newConnection)
	t.deepEqual(await app.db.query("connection"), [newConnection])

	await t.throwsAsync(async () => await app.create("connection", { ...newConnection, id: "fake" }))
})

test("only you can update your profiles or connections", async (t) => {
	const { app, newProfile, newRef, getNewConnection } = await getApp()

	// Create initial data
	await app.create("profile", newProfile)
	const { id: refId } = await app.create("ref", newRef)
	const newConnection = getNewConnection(refId)
	await app.create("connection", newConnection)

	// Try to update someone else's connection
	const fakeConnection = {
		...newConnection,
		id: "did:fake/123",
		creator: "did:fake",
	}
	await t.throwsAsync(async () => await app.update("connection", fakeConnection))

	// Verify original connection is unchanged
	t.deepEqual(await app.db.query("connection"), [newConnection])

	// Successfully update own connection
	const updatedConnection = {
		...newConnection,
		text: "Updated connection text",
	}
	await app.update("connection", updatedConnection)
	t.deepEqual(await app.db.query("connection"), [updatedConnection])
})

test("only you can delete connections", async (t) => {
	const { app, newProfile, newRef, getNewConnection } = await getApp()

	// Create initial data
	await app.create("profile", newProfile)
	const { id: refId } = await app.create("ref", newRef)
	const newConnection = getNewConnection(refId)
	await app.create("connection", newConnection)

	// Try to delete someone else's connection
	const fakeConnection = {
		...newConnection,
		id: "did:fake/123",
		creator: "did:fake",
	}
	await t.throwsAsync(async () => await app.delete("connection", fakeConnection.id))

	// Verify original connection still exists
	t.deepEqual(await app.db.query("connection"), [newConnection])

	// Successfully delete own connection
	await app.delete("connection", newConnection.id)
	t.deepEqual(await app.db.query("connection"), [])
})
