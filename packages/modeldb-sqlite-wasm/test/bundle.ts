import { TransientModelDB as ModelDBSqliteWasm } from "@canvas-js/modeldb-sqlite-wasm"

const main = async () => {
	const db = await ModelDBSqliteWasm.initialize({
		path: "db.sqlite",
		models: {
			user: {
				id: "primary",
				name: "string",
				isModerator: "boolean",
			},
		},
	})

	await db.set("user", { id: "john", name: "John", isModerator: false })
}

main()
