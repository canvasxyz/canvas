import { SIWESigner } from "@canvas-js/chain-ethereum"
import test, { ExecutionContext } from "ava"
import { Canvas } from "@canvas-js/core"

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
    await db.ytext.insert("articles", id, 0, "")
  },
  async insertIntoDoc(db, key, index, text) {
    await db.ytext.insert("articles", key, index, text)
  },
  async deleteFromDoc(db, key, index, length) {
    await db.ytext.delete("articles", key, index, length)
  }
};
`

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
	t.is(app1.getYDoc("articles", id).getText().toJSON(), "Hello, world")

	// create another app
	const { app: app2 } = await init(t)

	// sync the apps
	await app1.messageLog.serve((s) => app2.messageLog.sync(s))
	t.is(app2.getYDoc("articles", id).getText().toJSON(), "Hello, world")

	// insert ! into app1
	await app1.actions.insertIntoDoc(id, 12, "!")
	t.is(app1.getYDoc("articles", id).getText().toJSON(), "Hello, world!")

	// insert ? into app2
	await app2.actions.insertIntoDoc(id, 12, "?")
	t.is(app2.getYDoc("articles", id).getText().toJSON(), "Hello, world?")

	// sync app2 -> app1
	await app2.messageLog.serve((s) => app1.messageLog.sync(s))
	const app1MergedText = app1.getYDoc("articles", id).getText().toJSON()

	// sync app1 -> app2
	await app1.messageLog.serve((s) => app2.messageLog.sync(s))
	const app2MergedText = app2.getYDoc("articles", id).getText().toJSON()

	// both apps should now have converged
	t.is(app1MergedText, app2MergedText)
})
