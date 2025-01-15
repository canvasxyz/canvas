import test from "ava"

import { ModelSchema, parseConfig } from "@canvas-js/modeldb"

test("parse config", (t) => {
	const models: ModelSchema = {
		user: {
			id: "primary",
			address: "string",
			encryptionPublicKey: "bytes",
			signingPublicKey: "bytes",
		},

		room: {
			id: "primary",
			creator: "@user",
			members: "@user[]",
			$indexes: ["members", "id/creator"],
		},

		message: {
			id: "primary",
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
				indexes: [],
				primaryKey: "id",
				properties: [
					{ name: "id", kind: "primary" },
					{ name: "address", kind: "primitive", type: "string", nullable: false },
					{ name: "encryptionPublicKey", kind: "primitive", type: "bytes", nullable: false },
					{ name: "signingPublicKey", kind: "primitive", type: "bytes", nullable: false },
				],
			},
			{
				name: "room",
				indexes: [["id", "creator"]],
				primaryKey: "id",
				properties: [
					{ name: "id", kind: "primary" },
					{ name: "creator", kind: "reference", target: "user", nullable: false },
					{ name: "members", kind: "relation", target: "user" },
				],
			},
			{
				name: "message",
				indexes: [],
				primaryKey: "id",
				properties: [
					{ name: "id", kind: "primary" },
					{ name: "room", kind: "reference", target: "room", nullable: false },
					{ name: "sender", kind: "reference", target: "user", nullable: false },
					{ name: "content", kind: "primitive", type: "string", nullable: false },
					{ name: "timestamp", kind: "primitive", type: "integer", nullable: false },
				],
			},
		],

		relations: [{ source: "room", property: "members", target: "user", indexed: true }],
	})
})
