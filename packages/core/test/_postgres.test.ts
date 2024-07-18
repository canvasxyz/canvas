// const { POSTGRES_HOST, POSTGRES_PORT } = process.env

// function getPgConfig(): pg.ConnectionConfig | string {
// 	if (POSTGRES_HOST && POSTGRES_PORT) {
// 		return {
// 			user: "postgres",
// 			database: "test",
// 			password: "postgres",
// 			port: parseInt(POSTGRES_PORT),
// 			host: process.env.POSTGRES_HOST,
// 		}
// 	} else {
// 		return `postgresql://localhost:5432/test`
// 	}
// }

// const initPostgres = async (t: ExecutionContext, options: { reset: boolean } = { reset: true }) => {
// 	const app = await Canvas.initialize({
// 		path: getPgConfig(),
// 		contract,
// 		start: false,
// 		reset: options.reset,
// 		signers: [new Eip712Signer()],
// 	})
// 	t.teardown(() => app.stop())
// 	return app
// }

// test("open and close an app", async (t) => {
// 	const app = await init(t)
// 	t.pass()
// })

// test.serial("apply an action and read a record from the database using postgres", async (t) => {
// 	const app = await initPostgres(t)

// 	const { id, message } = await app.actions.createPost({
// 		content: "hello world",
// 		isVisible: true,
// 		something: -1,
// 		metadata: 0,
// 	})

// 	t.log(`applied action ${id}`)
// 	const postId = [message.payload.did, id].join("/")
// 	const value = await app.db.get("posts", postId)
// 	t.is(value?.content, "hello world")

// 	const { id: id2, message: message2 } = await app.actions.createPost({
// 		content: "foo bar",
// 		isVisible: true,
// 		something: -1,
// 		metadata: 0,
// 	})

// 	t.log(`applied action ${id2}`)
// 	const postId2 = [message2.payload.did, id2].join("/")
// 	const value2 = await app.db.get("posts", postId2)
// 	t.is(value2?.content, "foo bar")
// })

// test.serial("reset app to clear modeldb and gossiplog", async (t) => {
// 	const app = await initPostgres(t)

// 	const { id, message } = await app.actions.createPost({
// 		content: "hello world",
// 		isVisible: true,
// 		something: -1,
// 		metadata: 0,
// 	})

// 	const [clock1] = await app.messageLog.getClock()
// 	t.is(clock1, 3)

// 	const postId = [message.payload.did, id].join("/")
// 	const value1 = await app.db.get("posts", postId)
// 	t.is(value1?.content, "hello world")

// 	const [clock2] = await app.messageLog.getClock()
// 	t.is(clock2, 3)

// 	const app2 = await initPostgres(t, { reset: false })
// 	const value2 = await app2.db.get("posts", postId)
// 	t.is(value2?.content, "hello world")

// 	const [clock3] = await app2.messageLog.getClock()
// 	t.is(clock3, 3)

// 	const app3 = await initPostgres(t, { reset: true })
// 	const value3 = await app3.db.get("posts", postId)
// 	t.is(value3, null)

// 	const [clock4] = await app3.messageLog.getClock()
// 	t.is(clock4, 1)
// })

import test from "ava"

test("no-op", (t) => t.pass())
