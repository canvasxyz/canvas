import * as web3 from "web3"
import { getBytes, keccak256 } from "ethers"
import { TypedDataEncoder } from "ethers/hash"

import { Action, Message, Session } from "@canvas-js/interfaces"
type Codec = { name: string; code: number; encode: (value: any) => Iterable<Uint8Array> }

export function dynamicAbiEncodeArgs(args: Record<string, any>): string {
	const { types, values } = getAbiEncodeParametersArguments(args)
	return keccak256(web3.eth.abi.encodeParameters(types, values))
}

function getAbiTypeForValue(value: any) {
	if (typeof value === "string") {
		if (value.match(/^0x[0-9a-fA-F]{40}$/)) {
			return "address"
		} else {
			return "string"
		}
	} else if (typeof value === "number") {
		// if is integer
		if (Number.isInteger(value)) {
			return "int256"
		} else {
			throw new TypeError(`non-integer numbers are not yet supported`)
		}
	} else if (typeof value === "boolean") {
		return "bool"
	}
	throw new TypeError(`invalid type ${typeof value}`)
}

export function getAbiEncodeParametersArguments(args: Record<string, any>) {
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

export const eip712Codec: Codec = {
	name: "eip712",
	code: 712,
	encode: (message: Message<Action | Session>) => {
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
			hashedPayload = TypedDataEncoder.hash({}, types, {
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
			})
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
			hashedPayload = TypedDataEncoder.hash({}, types, {
				clock: message.clock,
				parents: message.parents,
				payload: {
					name: message.payload.name,
					args: dynamicAbiEncodeArgs(message.payload.args),
					address: message.payload.address.split(":")[2],
					blockhash: message.payload.blockhash || "",
					timestamp: message.payload.timestamp,
				},
				topic: message.topic,
			})
		} else {
			throw new TypeError("invalid payload type")
		}
		return [getBytes(hashedPayload)]
	},
}
