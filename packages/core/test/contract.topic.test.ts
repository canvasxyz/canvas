import test from "ava"
import * as cbor from "@ipld/dag-cbor"
import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"

import { Canvas, Contract, ModelSchema } from "@canvas-js/core"
import { PRNGSigner } from "./utils.js"

// Helper function to compute expected hash for topic components
function computeTopicHash(components: { args?: any[]; code?: string; snapshot?: any }): string {
	const topicHashComponents: { args?: Uint8Array; snapshot?: Uint8Array; code?: Uint8Array } = {}

	if (components.args && components.args.length > 0) {
		topicHashComponents.args = cbor.encode(components.args)
	}
	if (components.snapshot) {
		topicHashComponents.snapshot = sha256(cbor.encode(components.snapshot))
	}
	if (components.code) {
		topicHashComponents.code = sha256(components.code)
	}

	return bytesToHex(sha256(cbor.encode(topicHashComponents)).subarray(0, 16))
}

test("inline model contract has topic: example.com", async (t) => {
	const contract = { topic: "example.com", models: {} }

	const app = await Canvas.initialize({
		contract,
		signers: [new PRNGSigner(0)],
	})
	t.teardown(() => app.stop())

	t.is(app.topic, "example.com")
})

test("inline class contract has topic: example.com.Foo", async (t) => {
	class Foo extends Contract<typeof Foo.models> {
		static topic = "example.com"
		static models = {} satisfies ModelSchema
	}

	const app = await Canvas.initialize({
		contract: Foo,
		signers: [new PRNGSigner(0)],
	})
	t.teardown(() => app.stop())

	t.is(app.topic, "example.com.Foo")
})

test("inline class contract with args has topic: example.com.Foo:hash(args)", async (t) => {
	class Foo extends Contract<typeof Foo.models> {
		static topic = "example.com"
		static models = {} satisfies ModelSchema

		constructor(arg1: string, arg2: number) {
			super(arg1, arg2)
		}
	}

	const args = ["test", 42]
	const expectedHash = computeTopicHash({ args })

	const app = await Canvas.initialize({
		contract: Foo,
		args,
		signers: [new PRNGSigner(0)],
	})
	t.teardown(() => app.stop())

	t.is(app.topic, `example.com.Foo:${expectedHash}`)
})

test("string model contract has topic: example.com:hash(code)", async (t) => {
	const code = `
		import { Contract } from "@canvas-js/core/contract"

		export default class extends Contract {
			static topic = "example.com"
			static models = {}
		}
	`

	const expectedHash = computeTopicHash({ code })

	const app = await Canvas.initialize({
		contract: code,
		signers: [new PRNGSigner(0)],
	})
	t.teardown(() => app.stop())

	t.is(app.topic, `example.com:${expectedHash}`)
})

test("string class contract has topic: example.com.Foo:hash(code)", async (t) => {
	const code = `
		import { Contract } from "@canvas-js/core/contract"

		export default class Foo extends Contract {
			static topic = "example.com"
			static models = {}
		}
	`

	const expectedHash = computeTopicHash({ code })

	const app = await Canvas.initialize({
		contract: code,
		signers: [new PRNGSigner(0)],
	})
	t.teardown(() => app.stop())

	t.is(app.topic, `example.com.Foo:${expectedHash}`)
})

test("string class contract with args has topic: example.com.Foo:hash(args, code)", async (t) => {
	const code = `
		import { Contract } from "@canvas-js/core/contract"

		export default class Foo extends Contract {
			static topic = "example.com"
			static models = {}

			constructor(arg1, arg2) {
				super(arg1, arg2)
			}
		}
	`

	const args = ["test", 42]
	const expectedHash = computeTopicHash({ args, code })

	const app = await Canvas.initialize({
		contract: code,
		args,
		signers: [new PRNGSigner(0)],
	})
	t.teardown(() => app.stop())

	t.is(app.topic, `example.com.Foo:${expectedHash}`)
})

test("inline model contract has topic: example.com:hash(snapshot)", async (t) => {
	const contract = { topic: "example.com", models: {} }
	const snapshot = { type: "snapshot" as const, models: {} }
	const expectedHash = computeTopicHash({ snapshot })

	const app = await Canvas.initialize({
		contract,
		snapshot,
		reset: true,
		signers: [new PRNGSigner(0)],
	})
	t.teardown(() => app.stop())

	t.is(app.topic, `example.com:${expectedHash}`)
})

test("inline class contract has topic: example.com.Foo:hash(snapshot)", async (t) => {
	class Foo extends Contract<typeof Foo.models> {
		static topic = "example.com"
		static models = {} satisfies ModelSchema
	}

	const snapshot = { type: "snapshot" as const, models: {} }
	const expectedHash = computeTopicHash({ snapshot })

	const app = await Canvas.initialize({
		contract: Foo,
		snapshot,
		reset: true,
		signers: [new PRNGSigner(0)],
	})
	t.teardown(() => app.stop())

	t.is(app.topic, `example.com.Foo:${expectedHash}`)
})

test("inline class contract with args has topic: example.com.Foo:hash(args, code, snapshot)", async (t) => {
	class Foo extends Contract<typeof Foo.models> {
		static topic = "example.com"
		static models = {} satisfies ModelSchema

		constructor(arg1: string, arg2: number) {
			super(arg1, arg2)
		}
	}

	const args = ["test", 42]
	const snapshot = { type: "snapshot" as const, models: {} }
	const expectedHash = computeTopicHash({ args, snapshot })

	const app = await Canvas.initialize({
		contract: Foo,
		args,
		snapshot,
		reset: true,
		signers: [new PRNGSigner(0)],
	})
	t.teardown(() => app.stop())

	t.is(app.topic, `example.com.Foo:${expectedHash}`)
})

test("string model contract has topic: example.com:hash(code, snapshot)", async (t) => {
	const code = `
		import { Contract } from "@canvas-js/core/contract"

		export default class extends Contract {
			static topic = "example.com"
			static models = {}
		}
	`

	const snapshot = { type: "snapshot" as const, models: {} }
	const expectedHash = computeTopicHash({ code, snapshot })

	const app = await Canvas.initialize({
		contract: code,
		snapshot,
		reset: true,
		signers: [new PRNGSigner(0)],
	})
	t.teardown(() => app.stop())

	t.is(app.topic, `example.com:${expectedHash}`)
})

test("string class contract has topic: example.com.Foo:hash(code, snapshot)", async (t) => {
	const code = `
		import { Contract } from "@canvas-js/core/contract"

		export default class Foo extends Contract {
			static topic = "example.com"
			static models = {}
		}
	`

	const snapshot = { type: "snapshot" as const, models: {} }
	const expectedHash = computeTopicHash({ code, snapshot })

	const app = await Canvas.initialize({
		contract: code,
		snapshot,
		reset: true,
		signers: [new PRNGSigner(0)],
	})
	t.teardown(() => app.stop())

	t.is(app.topic, `example.com.Foo:${expectedHash}`)
})

test("string class contract with args has topic: example.com.Foo:hash(args, code, snapshot)", async (t) => {
	const code = `
		import { Contract } from "@canvas-js/core/contract"

		export default class Foo extends Contract {
			static topic = "example.com"
			static models = {}

			constructor(arg1, arg2) {
				super(arg1, arg2)
			}
		}
	`

	const args = ["test", 42]
	const snapshot = { type: "snapshot" as const, models: {} }
	const expectedHash = computeTopicHash({ args, code, snapshot })

	const app = await Canvas.initialize({
		contract: code,
		args,
		snapshot,
		reset: true,
		signers: [new PRNGSigner(0)],
	})
	t.teardown(() => app.stop())

	t.is(app.topic, `example.com.Foo:${expectedHash}`)
})
