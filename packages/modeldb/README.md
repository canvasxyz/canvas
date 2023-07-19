# @canvas-js/modeldb

ModelDB

- Relational
- Simple JSON schema
- Dual SQLite and IndexdDB backends
- Designed for p2p conlict resolution
- "Mutable" and "immutable" models

```ts
import { ModelDB } from "@canvas-js/modeldb"

const db = new ModelDB({
	user: {
		address: "string",
		encryptionPublicKey: "bytes",
		signingPublicKey: "bytes",
	},

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
})

const userId = modelDB.add("user", {
	address: "a",
	encryptionPublicKey: new Uint8Array([1, 2, 3]),
	signingPublicKey: new Uint8Array([4, 5, 6]),
})
```
