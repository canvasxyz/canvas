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

test.afterEach.always(async () => {
	await worker.stop()
})

test("durable object should store and return data in modeldb", async (t) => {
	const uuid = "d37f4bbf-d51c-4b20-8a1c-7bc53a588e4d"
	const data = { id: "foo", value: "123" }

	const clear = await worker.fetch(`http://example.com/${uuid}/clear`, {
		method: "POST",
	})
	t.is(clear.status, 200)

	const post = await worker.fetch(`http://example.com/${uuid}`, {
		method: "POST",
		body: JSON.stringify(data),
	})
	t.is(post.status, 200)

	const response = await worker.fetch(`http://example.com/${uuid}/${data.id}`)
	t.is(response.status, 200)
	t.deepEqual(JSON.parse(await response.text()), { id: "foo", value: "123" })
})
