import test from "ava"

import { ModelsInit, parseConfig } from "@canvas-js/modeldb"

test("parse config", (t) => {
	const models: ModelsInit = {
		user: {
			address: "string",
			encryptionPublicKey: "bytes",
			signingPublicKey: "bytes",
		},

		// @ts-ignore
		room: {
			creator: "@user",
			members: "@user[]",
			$indexes: ["members"],
		},

		message: {
			room: "@room",
			sender: "@user",
			content: "string",
			timestamp: "integer",
		},
	}

	t.deepEqual(parseConfig(models), {
		models: [
			{
				name: "user",
				kind: "immutable",
				indexes: [],
				properties: [
					{ name: "address", kind: "primitive", type: "string", optional: false },
					{ name: "encryptionPublicKey", kind: "primitive", type: "bytes", optional: false },
					{ name: "signingPublicKey", kind: "primitive", type: "bytes", optional: false },
				],
			},
			{
				name: "room",
				kind: "immutable",
				indexes: [],
				properties: [
					{ name: "creator", kind: "reference", target: "user", optional: false },
					{ name: "members", kind: "relation", target: "user" },
				],
			},
			{
				name: "message",
				kind: "immutable",
				indexes: [],
				properties: [
					{ name: "room", kind: "reference", target: "room", optional: false },
					{ name: "sender", kind: "reference", target: "user", optional: false },
					{ name: "content", kind: "primitive", type: "string", optional: false },
					{ name: "timestamp", kind: "primitive", type: "integer", optional: false },
				],
			},
		],

		relations: [{ source: "room", property: "members", target: "user", indexed: true }],
	})
})
