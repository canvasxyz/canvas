import { SIWESigner } from "@canvas-js/chain-ethereum"
import test, { ExecutionContext } from "ava"
import { Canvas } from "@canvas-js/core"
import * as Y from "yjs"

const contract = `
export const models = {
  articles: {
    id: "primary",
    content: "yjs-doc"
  }
};
export const actions = {
  async createNewArticle(db) {
    const { id } = this
    await db.yjsInsert("articles", id, 0, "")
  },
  async insertIntoDoc(db, key, index, text) {
    await db.yjsInsert("articles", key, index, text)
  },
  async deleteFromDoc(db, key, index, length) {
    await db.yjsDelete("articles", key, index, length)
  }
};
`

async function stringifyDoc(app: Canvas, key: string) {
	const doc = new Y.Doc()
	Y.applyUpdate(doc, (await app.db.get("articles:state", key))!.content)
	return doc.getText().toJSON()
}

const init = async (t: ExecutionContext) => {
	const signer = new SIWESigner()
	const app = await Canvas.initialize({
		contract,
		topic: "com.example.app",
		reset: true,
		signers: [signer],
	})

	t.teardown(() => app.stop())
	return { app, signer }
}

test("apply an action and read a record from the database", async (t) => {
	const { app: app1 } = await init(t)

	const { id } = await app1.actions.createNewArticle()

	t.log(`applied action ${id}`)

	await app1.actions.insertIntoDoc(id, 0, "Hello, world")
	t.is(await stringifyDoc(app1, id), "Hello, world")

	// create another app
	const { app: app2 } = await init(t)

	// sync the apps
	await app1.messageLog.serve((s) => app2.messageLog.sync(s))
	t.is(await stringifyDoc(app2, id), "Hello, world")

	// insert ! into app1
	await app1.actions.insertIntoDoc(id, 12, "!")
	t.is(await stringifyDoc(app1, id), "Hello, world!")

	// insert ? into app2
	await app2.actions.insertIntoDoc(id, 12, "?")
	t.is(await stringifyDoc(app2, id), "Hello, world?")

	// sync app2 -> app1
	await app2.messageLog.serve((s) => app1.messageLog.sync(s))
	const app1MergedText = await stringifyDoc(app1, id)

	// sync app1 -> app2
	await app1.messageLog.serve((s) => app2.messageLog.sync(s))
	const app2MergedText = await stringifyDoc(app2, id)

	// both apps should now have converged
	t.is(app1MergedText, app2MergedText)
})
