import { ModelsInit } from "../src/types.js"
import { testOnModelDB } from "./utils.js"

async function toArray<T>(asyncIterable: AsyncIterable<T>): Promise<T[]> {
	const arr = []
	for await (const i of asyncIterable) arr.push(i)
	return arr
}

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
		await toArray(
			db.query("user", {
				select: { name: true },
			})
		),
		[
			{
				name: "test",
			},
		]
	)
})
