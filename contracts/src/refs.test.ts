import test from "ava"
import refs, { models } from "./refs.js"

import { Canvas, DeriveModelTypes } from "@canvas-js/core"

type Models = DeriveModelTypes<typeof models>

test("create a profile, ref, and connection", async (t) => {
	const app = await Canvas.initialize({
		contract: refs,
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

	await app.create("profile", newProfile)

	t.deepEqual(await app.db.query("profile"), [newProfile])

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

	const { id: refId } = await app.create("ref", newRef)
	const [{ id, ...ref }] = await app.db.query("ref")
	t.deepEqual(ref, newRef)

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

	await app.create("connection", newConnection)
	t.deepEqual(await app.db.query("connection"), [newConnection])

	t.pass()
})

test.skip("only you can update your profiles or connections", (t) => {
	// app.update("")
})

test.skip("only you can delete connections", (t) => {
	// app.delete("")
})