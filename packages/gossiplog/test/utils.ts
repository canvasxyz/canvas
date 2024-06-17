import os from "node:os"
import fs from "node:fs"
import path from "node:path"

import test, { ExecutionContext } from "ava"
import "fake-indexeddb/auto"
import { locks, AbortController } from "web-locks"

import { nanoid } from "nanoid"
import { toString } from "uint8arrays"
import { PoolConfig } from "pg"

import { Key, Node } from "@canvas-js/okra"

import type { Signer, Message } from "@canvas-js/interfaces"
import { ed25519 } from "@canvas-js/signatures"
import { zip } from "@canvas-js/utils"

import { AbstractGossipLog, GossipLogInit, encodeId, decodeClock } from "@canvas-js/gossiplog"
import { GossipLog as GossipLogSqlite } from "@canvas-js/gossiplog/sqlite"
import { GossipLog as GossipLogIdb } from "@canvas-js/gossiplog/idb"
import { GossipLog as GossipLogPostgres } from "@canvas-js/gossiplog/pg"

// @ts-expect-error TS2322
globalThis.AbortController = AbortController

if (globalThis.navigator === undefined) {
	// @ts-expect-error
	globalThis.navigator = { locks }
} else {
	// @ts-expect-error
	globalThis.navigator.locks = locks
}

const { POSTGRES_HOST, POSTGRES_PORT } = process.env

function getPgConfig(): string | PoolConfig {
	if (POSTGRES_HOST && POSTGRES_PORT) {
		return {
			user: "postgres",
			database: "test",
			password: "postgres",
			port: parseInt(POSTGRES_PORT),
			host: POSTGRES_HOST,
		}
	} else {
		return `postgresql://localhost:5432/test`
	}
}

export const testPlatforms = (
	name: string,
	run: (
		t: ExecutionContext<unknown>,
		openGossipLog: <Payload>(t: ExecutionContext, init: GossipLogInit<Payload>) => Promise<AbstractGossipLog<Payload>>,
	) => void,
) => {
	const macro = test.macro(run)

	test(`Sqlite (on-disk) - ${name}`, macro, async (t, init) => {
		const log = new GossipLogSqlite({ ...init, directory: getDirectory(t) })
		t.teardown(() => log.close())
		return log
	})

	test(`Sqlite (in-memory) - ${name}`, macro, async (t, init) => {
		const log = new GossipLogSqlite(init)
		t.teardown(() => log.close())
		return log
	})

	test(`IndexedDB - ${name}`, macro, async (t, init) => {
		const log = await GossipLogIdb.open(init)
		t.teardown(() => log.close())
		return log
	})

	test(`Postgres - ${name}`, macro, async (t, init) => {
		const log = await GossipLogPostgres.open(getPgConfig(), { ...init, clear: true })
		t.teardown(() => log.close())
		return log
	})
}

export async function expectLogEntries<T>(
	t: ExecutionContext<unknown>,
	log: AbstractGossipLog<T>,
	entries: [id: string, publicKey: string, message: Message<T>][],
) {
	const records = await log.export()
	// console.log("got records", records)
	t.is(records.length, entries.length, `unexpected length`)
	for (const [[id, publicKey, message], record, i] of zip(entries, records)) {
		t.is(record.id, id, `unexpected id at index ${i}`)
		t.is(record.signature.publicKey, publicKey, `unexpected public key at index ${i}`)
		t.deepEqual(record.message, message, `unexpected message at index ${i}`)
	}
}

export function getDirectory(t: ExecutionContext<unknown>): string {
	const directory = path.resolve(os.tmpdir(), nanoid())
	fs.mkdirSync(directory)
	t.log("Created temporary directory", directory)
	t.teardown(() => {
		fs.rmSync(directory, { recursive: true })
		t.log("Removed temporary directory", directory)
	})
	return directory
}

export const printKey = (key: Key) => (key === null ? "null" : toString(key, "hex"))
export const printNode = (node: Node) => `{ ${node.level} | ${printKey(node.key)} | ${toString(node.hash, "hex")} }`

// export async function collect<T, O = T>(iter: AsyncIterable<T>, map?: (value: T) => O): Promise<O[]> {
// 	const values: O[] = []
// 	for await (const value of iter) {
// 		if (map !== undefined) {
// 			values.push(map(value))
// 		} else {
// 			values.push(value as O)
// 		}
// 	}

// 	return values
// }

export function shuffle<T>(array: T[]) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[array[i], array[j]] = [array[j], array[i]]
	}
}

export async function appendChain(
	log: AbstractGossipLog<string>,
	rootId: string,
	n: number,
	options: { signer?: Signer<string> } = {},
): Promise<string[]> {
	const signer = options.signer ?? ed25519.create()

	const [clock] = decodeClock(encodeId(rootId))

	const ids: string[] = []
	for (let i = 0; i < n; i++) {
		const message: Message<string> = {
			topic: log.topic,
			clock: clock + i + 1,
			parents: i === 0 ? [rootId] : [ids[i - 1]],
			payload: nanoid(),
		}

		const signature = await signer.sign(message)
		const signedMessage = log.encode(signature, message)
		await log.insert(signedMessage)
		ids.push(signedMessage.id)
	}

	return ids
}
