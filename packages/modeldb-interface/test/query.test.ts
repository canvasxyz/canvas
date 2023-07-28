import { ModelsInit } from "../src/types.js"
import { testOnModelDB } from "./utils.js"

testOnModelDB("query the database using select", async (t, modelDBConstructor) => {
	// @ts-ignore
	const models = {
		user: {
			name: "string",
			age: "integer",
			$type: "immutable",
		},
	} as ModelsInit
	const db = await modelDBConstructor(models)

	await db.add("user", { name: "test", age: 10 })

	t.deepEqual(
		await db.query("user", {
			select: { name: true },
		}),
		[
			{
				name: "test",
			},
		]
	)
})
