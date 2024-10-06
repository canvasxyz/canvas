import assert from "node:assert"
import test from "ava"

import { ethers } from "ethers"

import { SIWESigner, Eip712Signer } from "@canvas-js/chain-ethereum"
import { Canvas } from "@canvas-js/core"

test("validate action args using IPLD schemas", async (t) => {
	const schema = `
		type CreatePostPayload struct {
			content String
			inReplyTo nullable String
		} representation tuple
	`

	const wallet = ethers.Wallet.createRandom()
	const app = await Canvas.initialize({
		topic: "com.example.app",
		contract: {
			models: {
				posts: {
					id: "primary",
					content: "string",
					timestamp: "integer",
					address: "string",
				},
			},
			actions: {
				createPost: {
					requireSessionAuthentication: false,
					argsType: { schema, name: "CreatePostPayload" },
					apply: async (
						db,
						{ content, inReplyTo }: { content: string; inReplyTo: string | null },
						{ id, address, timestamp },
					) => {
						const postId = [address, id].join("/")
						await db.set("posts", { id: postId, content, timestamp, address })
					},
				},
			},
		},
		signers: [new SIWESigner({ signer: wallet })],
	})

	t.teardown(() => app.stop())

	const { id } = await app.actions.createPost({ content: "hello world!", inReplyTo: null })

	// validate that the args are represented as tuples inside the action
	const signedMessage = await app.getMessage(id)
	assert(signedMessage !== null && signedMessage.message.payload.type === "action")
	t.deepEqual(signedMessage.message.payload.args, ["hello world!", null])

	await t.throwsAsync(() => app.actions.createPost({ content: 8 } as any), {
		message: "action args did not validate the provided schema type",
	})

	t.is(await app.db.count("posts"), 1)
})
