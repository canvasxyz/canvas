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
import { Ed25519Signer } from "@canvas-js/signed-cid"

import { AbstractGossipLog, GossipLogInit, encodeId, decodeClock } from "@canvas-js/gossiplog"
import { GossipLog as GossipLogNode } from "@canvas-js/gossiplog/node"
import { GossipLog as GossipLogBrowser } from "@canvas-js/gossiplog/browser"
import { GossipLog as GossipLogMemory } from "@canvas-js/gossiplog/memory"
import { GossipLog as GossipLogPostgres } from "@canvas-js/gossiplog/pg"

// @ts-expect-error
globalThis.AbortController = AbortController

if (globalThis.navigator === undefined) {
	// @ts-expect-error
	globalThis.navigator = { locks }
} else {
	// @ts-expect-error
	globalThis.navigator.locks = locks
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
	// test(`Memory - ${name}`, macro, (t, init) => GossipLogMemory.open(init))
	// test(`Browser - ${name}`, macro, (t, init) => GossipLogBrowser.open(init))
	// test(`NodeJS - ${name}`, macro, (t, init) => GossipLogNode.open(init, getDirectory(t)))
	test.serial(`Postgres - ${name}`, macro, (t, init) =>
		GossipLogPostgres.open(init, "postgresql://localhost:5432/test"),
	)
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

export const mapEntries = <K extends string, S, T>(object: Record<K, S>, map: (entry: [key: K, value: S]) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map([key as K, value])])) as Record<K, T>

export const mapKeys = <K extends string, S, T>(object: Record<K, S>, map: (key: K) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map(key as K)])) as Record<K, T>

export const mapValues = <K extends string, S, T>(object: Record<K, S>, map: (value: S) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map(value)])) as Record<K, T>

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
	options: { signer?: Signer<Message<string>> } = {},
): Promise<string[]> {
	const signer = options.signer ?? new Ed25519Signer()

	const [clock] = decodeClock(encodeId(rootId))

	const ids: string[] = []
	for (let i = 0; i < n; i++) {
		const message: Message<string> = {
			topic: log.topic,
			clock: Number(clock) + i + 1,
			parents: i === 0 ? [rootId] : [ids[i - 1]],
			payload: nanoid(),
		}

		const signature = await signer.sign(message)
		const { id } = await log.insert(signature, message)
		ids.push(id)
	}

	return ids
}
