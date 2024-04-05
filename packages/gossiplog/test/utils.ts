import os from "node:os"
import fs from "node:fs"
import path from "node:path"

import test, { ExecutionContext } from "ava"
import "fake-indexeddb/auto"
import { locks, AbortController } from "web-locks"

import { nanoid } from "nanoid"

import { bytesToHex } from "@noble/hashes/utils"
import { Key, Node } from "@canvas-js/okra"

import type { Signature, Signer, Message } from "@canvas-js/interfaces"
import { Ed25519DelegateSigner } from "@canvas-js/signatures"

import { AbstractGossipLog, GossipLogInit, encodeId, decodeClock } from "@canvas-js/gossiplog"
import { GossipLog as GossipLogNode } from "@canvas-js/gossiplog/node"
import { GossipLog as GossipLogBrowser } from "@canvas-js/gossiplog/browser"
import { GossipLog as GossipLogMemory } from "@canvas-js/gossiplog/memory"
import { GossipLog as GossipLogPostgres } from "@canvas-js/gossiplog/pg"
import { PoolConfig } from "pg"

// @ts-expect-error
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
		openGossipLog: <Payload, Results>(
			t: ExecutionContext,
			init: GossipLogInit<Payload, Results>,
		) => Promise<AbstractGossipLog<Payload, Results>>,
	) => void,
) => {
	const macro = test.macro(run)

	test(`Memory - ${name}`, macro, async (t, init) => {
		const log = await GossipLogMemory.open(init)
		t.teardown(() => log.close())
		return log
	})
	test(`Browser - ${name}`, macro, async (t, init) => {
		const log = await GossipLogBrowser.open(init)
		t.teardown(() => log.close())
		return log
	})
	test(`NodeJS - ${name}`, macro, async (t, init) => {
		const log = await GossipLogNode.open(init, getDirectory(t))
		t.teardown(() => log.close())
		return log
	})
	test.serial(`Postgres - ${name}`, macro, async (t, init) => {
		const log = await GossipLogPostgres.open(init, getPgConfig(), true)
		t.teardown(() => log.close())
		return log
	})
}

export const getPublicKey = <T>([id, { publicKey }, message]: [string, Signature, Message<T>]): [
	id: string,
	publicKey: string,
	message: Message<T>,
] => [id, publicKey, message]

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

export const printKey = (key: Key) => (key === null ? "null" : bytesToHex(key))
export const printNode = (node: Node) => `{ ${node.level} | ${printKey(node.key)} | ${bytesToHex(node.hash)} }`

export async function collect<T, O = T>(iter: AsyncIterable<T>, map?: (value: T) => O): Promise<O[]> {
	const values: O[] = []
	for await (const value of iter) {
		if (map !== undefined) {
			values.push(map(value))
		} else {
			values.push(value as O)
		}
	}

	return values
}

export function shuffle<T>(array: T[]) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[array[i], array[j]] = [array[j], array[i]]
	}
}

export async function appendChain(
	log: AbstractGossipLog<string, void>,
	rootId: string,
	n: number,
	options: { signer?: Signer<string> } = {},
): Promise<string[]> {
	const signer = options.signer ?? new Ed25519DelegateSigner()

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
		const { id } = await log.insert(signature, message)
		ids.push(id)
	}

	return ids
}
