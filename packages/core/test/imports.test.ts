import assert from "node:assert"
import test from "ava"
import { Canvas } from "@canvas-js/core"

import { capturedImportsEqual } from "@canvas-js/core"

const foo = 1
const bar = "2"
const baz = (a: number, b: number) => a + b
const qux = null

test("passes contract.imports to FunctionRuntime calls", async (t) => {
	const imports = { foo, bar, baz, qux }

	const app = await Canvas.initialize({
		topic: "com.example.app",
		contract: {
			models: {
				results: { id: "primary", value: "json" },
			},
			actions: {
				async returnImportedValues(db, args, { id }) {
					// @ts-ignore
					const value = { foo, bar, baz: baz(1, 2), qux } as any
					await db.set("results", { id, value })
				},
			},
			imports,
		},
	})

	t.teardown(() => app.stop())

	await app.actions.returnImportedValues()

	const result = (await app.db.query("results"))[0].value
	assert(result !== null)

	t.true(capturedImportsEqual(imports.foo, result.foo))
	t.true(capturedImportsEqual(imports.bar, result.bar))
	t.true(capturedImportsEqual(imports.baz(1, 2), result.baz))
	t.true(capturedImportsEqual(imports.qux, result.qux))
})
