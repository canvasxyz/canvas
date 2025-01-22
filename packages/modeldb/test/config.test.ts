import test from "ava"

import { ModelSchema, Config } from "@canvas-js/modeldb"

test("parse config", (t) => {
	const { models, relations } = Config.parse({
		user: {
			id: "primary",
			address: "string",
			encryptionPublicKey: "bytes",
			signingPublicKey: "bytes",
		},

		room: {
			$primary: "id",
			id: "primary",
			creator: "@user",
			members: "@user[]",
			$indexes: ["members", "id/creator"],
		},

		message: {
			$primary: "id",
			id: "string",
			room: "@room",
			sender: "@user",
			content: "string",
			timestamp: "integer",
		},
	})

	t.deepEqual(models, [
		{
			name: "user",
			indexes: [],
			primaryKey: "id",
			properties: [
				{ name: "id", kind: "primitive", type: "string", nullable: false },
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
				{ name: "id", kind: "primitive", type: "string", nullable: false },
				{ name: "creator", kind: "reference", target: "user", nullable: false },
				{ name: "members", kind: "relation", target: "user" },
			],
		},
		{
			name: "message",
			indexes: [],
			primaryKey: "id",
			properties: [
				{ name: "id", kind: "primitive", type: "string", nullable: false },
				{ name: "room", kind: "reference", target: "room", nullable: false },
				{ name: "sender", kind: "reference", target: "user", nullable: false },
				{ name: "content", kind: "primitive", type: "string", nullable: false },
				{ name: "timestamp", kind: "primitive", type: "integer", nullable: false },
			],
		},
	])

	t.deepEqual(relations, [
		{
			source: "room",
			sourceProperty: "members",
			sourcePrimaryKey: { name: "id", kind: "primitive", type: "string", nullable: false },
			target: "user",
			targetPrimaryKey: { name: "id", kind: "primitive", type: "string", nullable: false },
			indexed: true,
		},
	])
})

test("broken relation target", (t) => {
	t.throws(() => {
		Config.parse({
			room: {
				id: "primary",
				name: "string",
				isModerator: "boolean",
				creator: "@user",
				members: "@user[]",
			},
		})
	})
})
