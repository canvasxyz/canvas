import { getBytes } from "ethers"
import { AbiCoder } from "ethers/abi"
import { TypedDataEncoder } from "ethers/hash"

import { Action, Message, Session } from "@canvas-js/interfaces"
type Codec = { name: string; code: number; encode: (value: any) => Iterable<Uint8Array> }

/**
 * Encode `Message<Action | Session>` using Ethereum typed data encoding.
 *
 * Messages may contain dynamically typed data:
 * - Objects may contain strings, numbers, or booleans.
 *   These are encoded as `string`, `int256`, and `bool`.
 * - Numbers must be integers.
 * - 40-byte-long hex strings (starting with "0x") are encoded as `address`.
 *
 * TODO: Objects encoded as `bytes` as `getBytes(AbiCoder().encode(types, values))`.
 * TODO: Null encoded as `bytes` with length zero.
 *
 * While the codec is implemented for dynamically typed data, if you are
 * writing an onchain verifier for offchain signed data, it must still be
 * statically typed to a specific action schema beforehand. See
 * @canvas-js/ethereum-contracts for examples.
 */
export const encode = (message: Message<Action | Session>): Uint8Array => {
	let hashedPayload: string
	if (message.payload.type === "session") {
		const types = {
			Message: [
				{ name: "clock", type: "uint256" },
				{ name: "parents", type: "string[]" },
				{ name: "payload", type: "Session" },
				{ name: "topic", type: "string" },
			],
			Session: [
				{ name: "address", type: "address" },
				{ name: "blockhash", type: "string" },
				{ name: "duration", type: "uint256" },
				{ name: "publicKey", type: "string" },
				{ name: "timestamp", type: "uint256" },
			],
		}
		hashedPayload = TypedDataEncoder.hash(
			{
				name: message.topic,
			},
			types,
			{
				clock: message.clock,
				parents: message.parents,
				payload: {
					address: message.payload.address.split(":")[2],
					publicKey: message.payload.publicKey,
					blockhash: message.payload.blockhash,
					timestamp: message.payload.timestamp,
					duration: message.payload.duration,
				},
				topic: message.topic,
			},
		)
	} else if (message.payload.type === "action") {
		const types = {
			Message: [
				{ name: "clock", type: "uint256" },
				{ name: "parents", type: "string[]" },
				{ name: "payload", type: "Action" },
				{ name: "topic", type: "string" },
			],
			Action: [
				{ name: "address", type: "address" },
				{ name: "args", type: "bytes" },
				{ name: "blockhash", type: "string" },
				{ name: "name", type: "string" },
				{ name: "timestamp", type: "uint256" },
			],
		}
		hashedPayload = TypedDataEncoder.hash(
			{
				name: message.topic,
			},
			types,
			{
				clock: message.clock,
				parents: message.parents,
				payload: {
					name: message.payload.name,
					args: getAbiString(message.payload.args),
					address: message.payload.address.split(":")[2],
					blockhash: message.payload.blockhash || "",
					timestamp: message.payload.timestamp,
				},
				topic: message.topic,
			},
		)
	} else {
		throw new TypeError("invalid payload type")
	}
	return getBytes(hashedPayload)
}

/**
 * Encode an argument object `Record<string, any>` as an ABI-encoded bytestring.
 */
export function getAbiString(args: Record<string, any>): string {
	const { types, values } = getEIP712Args(args)
	return new AbiCoder().encode(types, values)
}

/**
 * Convert an argument object `Record<string, any>` to EIP712-compatible types.
 */
export function getEIP712Args(args: Record<string, any>) {
	const sortedArgs = Object.keys(args).sort()

	const types: string[] = []
	const values: any[] = []

	for (const key of sortedArgs) {
		types.push("string")
		values.push(key)

		types.push(getAbiTypeForValue(args[key]))
		values.push(args[key])
	}
	return { types, values }
}

/**
 * Convert a JS primitive type to an EIP712-compatible type.
 */
function getAbiTypeForValue(value: any) {
	if (typeof value === "string") {
		if (value.match(/^0x[0-9a-fA-F]{40}$/)) {
			return "address"
		} else {
			return "string"
		}
	} else if (typeof value === "number") {
		if (Number.isInteger(value)) {
			return "int256"
		} else {
			throw new TypeError(`cannot encode floats`)
		}
	} else if (typeof value === "boolean") {
		return "bool"
	}
	throw new TypeError(`invalid type ${typeof value}: ${JSON.stringify(value)}`)
}
