import test from "ava"

import { ModelDB } from "@canvas-js/modeldb-durable-objects"

import { unstable_dev } from "wrangler"
import type { UnstableDevWorker } from "wrangler"

let worker: UnstableDevWorker

test.beforeEach(async () => {
	worker = await unstable_dev("test/worker.ts", {
		experimental: { disableExperimentalWarning: true },
	})
})

test.afterEach(async () => {
	await worker.stop()
})

test("durable object should store and return data in modeldb", async (t) => {
	const uuid = "d37f4bbf-d51c-4b20-8a1c-7bc53a588e4d"

	const post = await worker.fetch(`http://example.com/${uuid}`, {
		method: "POST",
		body: JSON.stringify({ key: "foo", value: "123" }),
	})
	t.true(post.ok)
	t.is(post.status, 200)

	console.log("put", await post.text())

	const key = "foo"
	const response = await worker.fetch(`http://example.com/${uuid}/${key}`)
	t.true(response.ok)
	t.is(response.status, 200)

	const data = await response.json()
	console.log("get", data)
	t.deepEqual(data, { key: "foo", value: "123" })
})
