import os from "node:os"
import fs from "node:fs"
import path from "node:path"

import { ExecutionContext } from "ava"
import { nanoid } from "nanoid"

import { ed25519 } from "@noble/curves/ed25519"
import { bytesToHex } from "@noble/hashes/utils"
import { Key, Node } from "@canvas-js/okra-node"

import { createSignature } from "@canvas-js/signed-cid"
import { Message } from "@canvas-js/interfaces"

export class Ed25519Signer<T = unknown> {
	private readonly privateKey = ed25519.utils.randomPrivateKey()
	public readonly publicKey = ed25519.getPublicKey(this.privateKey)

	sign(message: Message<T>) {
		return createSignature("ed25519", this.privateKey, message)
	}
}

export function getDirectory(t: ExecutionContext<unknown>): string {
	const directory = path.resolve(os.tmpdir(), nanoid())
	console.log("CREATING", directory)
	fs.mkdirSync(directory)
	t.teardown(() => {
		console.log("REMOVING", directory)
		fs.rmSync(directory, { recursive: true })
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
