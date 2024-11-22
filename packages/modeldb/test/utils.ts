import "fake-indexeddb/auto"
import path from "node:path"
import test, { ExecutionContext } from "ava"
import puppeteer from "puppeteer"
import { nanoid } from "nanoid"

import { fileURLToPath } from "node:url"
import { createServer, ViteDevServer } from "vite"

import { unstable_dev } from "wrangler"
import type { UnstableDevWorker } from "wrangler"

const __dirname = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

import type { AbstractModelDB, ModelSchema } from "@canvas-js/modeldb"
import { ModelDB as ModelDBSqlite } from "@canvas-js/modeldb-sqlite"
import { ModelDB as ModelDBIdb } from "@canvas-js/modeldb-idb"
import { ModelDB as ModelDBPostgres } from "@canvas-js/modeldb-pg"
import { ModelDBProxy as ModelDBDurableObjectsProxy } from "@canvas-js/modeldb-durable-objects"
import { ModelDB as ModelDBSqliteExpo } from "@canvas-js/modeldb-sqlite-expo"

let browser: puppeteer.Browser
let page: puppeteer.Page
let server: ViteDevServer
let worker: UnstableDevWorker

test.before(async (t) => {
	server = await createServer({
		root: path.resolve(__dirname, "server"),
	})

	await server.listen()

	browser = await puppeteer.launch({
		dumpio: true,
		headless: true,
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-extensions",
			"--enable-chrome-browser-cloud-management",
		],
	})
	page = await browser.newPage()

	page.on("workercreated", (worker) => t.log("Worker created: " + worker.url()))
	page.on("workerdestroyed", (worker) => t.log("Worker destroyed: " + worker.url()))

	page.on("console", async (e) => {
		const args = await Promise.all(e.args().map((a) => a.jsonValue()))
		t.log(...args)
	})

	const { port } = server.config.server
	await page.goto(`http://localhost:${port}`)

	worker = await unstable_dev("test/worker.ts", {
		experimental: { disableExperimentalWarning: true },
	})
})

test.after(async (t) => {
	await page.close()
	await browser.close()
	await server.close()
	worker.stop()
})

function getConnectionConfig() {
	const { POSTGRES_HOST, POSTGRES_PORT } = process.env
	if (POSTGRES_HOST && POSTGRES_PORT) {
		return {
			user: "postgres",
			database: "test",
			password: "postgres",
			port: parseInt(POSTGRES_PORT),
			host: POSTGRES_HOST,
		}
	} else {
		return "postgresql://localhost:5432/test"
	}
}

export const testOnModelDBNoWasm = (
	name: string,
	run: (
		t: ExecutionContext<unknown>,
		openDB: (t: ExecutionContext, models: ModelSchema) => Promise<AbstractModelDB>,
	) => void,
) => {
	return testOnModelDB(name, run, { sqliteWasm: false, sqlite: true, idb: true, pg: true, do: true, expo: true })
}

export const testOnModelDB = (
	name: string,
	run: (
		t: ExecutionContext<unknown>,
		openDB: (t: ExecutionContext, models: ModelSchema) => Promise<AbstractModelDB>,
	) => void,
	platforms: { sqliteWasm: boolean; sqlite: boolean; idb: boolean; pg: boolean; do: boolean; expo: boolean } = {
		sqliteWasm: true,
		sqlite: true,
		idb: true,
		pg: true,
		do: true,
		expo: true,
	},
) => {
	const macro = test.macro(run)

	const connectionConfig = getConnectionConfig()

	if (platforms.sqlite) {
		test(`Sqlite - ${name}`, macro, async (t, models) => {
			const mdb = new ModelDBSqlite({ path: null, models })
			t.teardown(() => mdb.close())
			return mdb
		})
	}

	if (platforms.idb) {
		test(`IDB - ${name}`, macro, async (t, models) => {
			const mdb = await ModelDBIdb.initialize({ name: nanoid(), models })
			t.teardown(() => mdb.close())
			return mdb
		})
	}

	if (platforms.pg) {
		test.serial(`Postgres - ${name}`, macro, async (t, models) => {
			const mdb = await ModelDBPostgres.initialize({ connectionConfig, models, clear: true })
			t.teardown(() => mdb.close())
			return mdb
		})
	}

	if (platforms.do) {
		test.serial(`Durable Objects - ${name}`, macro, async (t, models) => {
			const mdb = new ModelDBDurableObjectsProxy(worker, models)
			await mdb.initialize()
			return mdb
		})
	}

	if (platforms.expo) {
		// test(`React Native - ${name}`, macro, async (t, models) => {
		// 	const mdb = new ModelDBSqliteExpo({ path: null, models })
		// 	t.teardown(() => mdb.close())
		// 	return mdb
		// })
	}

	if (platforms.sqliteWasm) {
		test(`Sqlite Wasm Opfs - ${name}`, async (t) => {
			const testResult = await page.evaluate(async (run) => {
				// @ts-ignore
				const ctx = new InnerExecutionContext()
				const testFunc = eval(`(${run})`)
				try {
					// @ts-ignore
					await testFunc(ctx, openOpfsDB)
					return { result: "passed" }
				} catch (error: any) {
					return { result: "failed", error: error.message }
				} finally {
					if (ctx.teardownFunction) ctx.teardownFunction()
				}
			}, run.toString())

			if (testResult.result === "passed") {
				t.pass()
			} else {
				t.fail(testResult.error)
			}
		})
		test(`Sqlite Wasm Transient - ${name}`, async (t) => {
			const testResult = await page.evaluate(async (run) => {
				// @ts-ignore
				const ctx = new InnerExecutionContext()
				const testFunc = eval(`(${run})`)
				try {
					// @ts-ignore
					await testFunc(ctx, openTransientDB)
					return { result: "passed" }
				} catch (error: any) {
					return { result: "failed", error: error.message }
				} finally {
					if (ctx.teardownFunction) ctx.teardownFunction()
				}
			}, run.toString())

			if (testResult.result === "passed") {
				t.pass()
			} else {
				t.fail(testResult.error)
			}
		})
	}
}

export const compareUnordered = (t: ExecutionContext, a: any[], b: any[]) => {
	t.is(a.length, b.length)

	const serializedA = a.map((x) => JSON.stringify(x)).sort()
	const serializedB = b.map((x) => JSON.stringify(x)).sort()
	t.deepEqual(serializedA, serializedB)
}

export async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
	const values: T[] = []
	for await (const value of iter) {
		values.push(value)
	}
	return values
}
