import test from "ava"
import { unstable_dev } from "wrangler"
import type { UnstableDevWorker } from "wrangler"
import { ModelDBProxy } from "@canvas-js/modeldb-durable-objects"

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

	const proxy = new ModelDBProxy(worker, {
		store: {
			id: "primary",
			value: "json",
		},
	})
	await proxy.initialize()

	await proxy.clear("store")

	await proxy.set("store", { id: "foo", value: "123" })

	const result = await proxy.get("store", "foo")

	t.deepEqual(result, { id: "foo", value: "123" })
})
