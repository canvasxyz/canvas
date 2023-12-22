import * as web3 from "web3"
import { getBytes } from "ethers"
import { TypedDataEncoder } from "ethers/hash"

import { Action, Message, Session } from "@canvas-js/interfaces"
type Codec = { name: string; code: number; encode: (value: any) => Iterable<Uint8Array> }

function dynamicAbiEncodeArgs(args: Record<string, any>): string {
	const types: string[] = []
	const values: any[] = []
	for (const key in args) {
		types.push("string")
		values.push(key)
		if (typeof args[key] === "string") {
			if (args[key].match(/^0x[0-9a-fA-F]{40}$/)) {
				types.push("address")
			} else {
				types.push("string")
			}
		} else if (typeof args[key] === "number") {
			types.push("int256")
		} else if (typeof args[key] === "boolean") {
			types.push("boolean")
		}

		values.push(args[key])
	}
	return web3.eth.abi.encodeParameters(types, values)
}

export const eip712Codec: Codec = {
	name: "eip712",
	code: 712,
	encode: (message: Message<Action | Session>) => {
		let hashedPayload: string
		if (message.payload.type === "session") {
			const sessionType = [
				{ name: "address", type: "address" },
				{ name: "publicKey", type: "string" },
				{ name: "blockhash", type: "string" },
				{ name: "timestamp", type: "uint256" },
				{ name: "duration", type: "uint256" },
			]
			const { address, publicKey, blockhash, timestamp, duration } = message.payload
			hashedPayload = TypedDataEncoder.hash(
				{},
				{ Session: sessionType },
				{ address: address.split(":")[2], publicKey, blockhash, timestamp, duration },
			)
		} else if (message.payload.type === "action") {
			const actionType = [
				{ name: "name", type: "string" },
				{ name: "args", type: "bytes" },
				{ name: "address", type: "address" },
				{ name: "blockhash", type: "string" },
				{ name: "timestamp", type: "uint256" },
			]
			const { name, args, address, blockhash, timestamp } = message.payload
			const encodedArgs = dynamicAbiEncodeArgs(args)
			hashedPayload = TypedDataEncoder.hash(
				{},
				{ Action: actionType },
				{ name, args: encodedArgs, address: address.split(":")[2], blockhash: blockhash || "", timestamp },
			)
		} else {
			throw new TypeError("invalid payload type")
		}

		// encode outer message object
		const encodedMessage = web3.eth.abi.encodeParameters(
			["uint8", "string[]", "bytes32", "string"],
			[message.clock, message.parents, hashedPayload, message.topic],
		)
		return [getBytes(encodedMessage)]
	},
}
