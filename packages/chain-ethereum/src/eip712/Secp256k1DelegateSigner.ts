import {
	SigningKey,
	BaseWallet,
	Wallet,
	getBytes,
	hexlify,
	TypedDataField,
	verifyTypedData,
	computeAddress,
} from "ethers"

import { AbiCoder } from "ethers/abi"

import type { Action, Message, Session, Signature, SignatureScheme, Signer } from "@canvas-js/interfaces"
import { decodeURI, encodeURI } from "@canvas-js/signatures"
import { assert, signalInvalidType } from "@canvas-js/utils"

import { Eip712SessionData } from "./types.js"
import { parseAddress } from "./utils.js"

export const codecs = {
	action: "canvas-action-eip712",
	session: "canvas-session-eip712",
}

/**
 * Secp256k1DelegateSigner ONLY supports the following codecs:
 * - canvas-action-eip712
 * - canvas-session-eip712
 */
export class Secp256k1DelegateSigner implements Signer<Action | Session<Eip712SessionData>> {
	public static eip712ActionTypes = {
		Message: [
			{ name: "topic", type: "string" },
			{ name: "clock", type: "uint64" },
			{ name: "parents", type: "string[]" },
			{ name: "payload", type: "Action" },
		],
		Action: [
			{ name: "userAddress", type: "address" },
			{ name: "args", type: "bytes" },
			{ name: "name", type: "string" },
			{ name: "timestamp", type: "uint64" },
			{ name: "blockhash", type: "string" },
		],
	} satisfies Record<string, TypedDataField[]>

	public static eip712SessionTypes = {
		Message: [
			{ name: "topic", type: "string" },
			{ name: "clock", type: "uint64" },
			{ name: "parents", type: "string[]" },
			{ name: "payload", type: "Session" },
		],
		Session: [
			{ name: "userAddress", type: "address" },
			{ name: "publicKey", type: "bytes" },
			{ name: "authorizationData", type: "AuthorizationData" },
			{ name: "duration", type: "uint64" },
			{ name: "timestamp", type: "uint64" },
			{ name: "blockhash", type: "string" },
		],
		AuthorizationData: [{ name: "signature", type: "bytes" }],
	} satisfies Record<string, TypedDataField[]>

	public readonly scheme: SignatureScheme<Action | Session<Eip712SessionData>> = Secp256k1SignatureScheme
	public readonly publicKey: string

	readonly #wallet: BaseWallet

	public constructor(init?: { type: string; privateKey: Uint8Array }) {
		if (init === undefined) {
			this.#wallet = Wallet.createRandom()
		} else {
			assert(init.type === Secp256k1SignatureScheme.type)
			this.#wallet = new Wallet(hexlify(init.privateKey))
		}

		const publicKey = getBytes(this.#wallet.signingKey.compressedPublicKey)
		this.publicKey = encodeURI(Secp256k1SignatureScheme.type, publicKey)
	}

	public async sign(message: Message<Action | Session<Eip712SessionData>>): Promise<Signature> {
		const { topic, clock, parents, payload } = message

		if (payload.type === "action") {
			const { address } = parseAddress(payload.did)

			const signature = await this.#wallet.signTypedData(
				{ name: message.topic },
				Secp256k1DelegateSigner.eip712ActionTypes,
				{
					topic: topic,
					clock: clock,
					parents: parents,
					payload: {
						name: payload.name,
						args: getAbiString(payload.args),
						userAddress: address,
						blockhash: payload.context.blockhash || "", // TODO: consider making blockhash mandatory for EIP-712?
						timestamp: payload.context.timestamp,
					},
				},
			)

			return { codec: codecs.action, publicKey: this.publicKey, signature: getBytes(signature) }
		} else if (payload.type === "session") {
			const { address } = parseAddress(payload.did)

			assert(payload.publicKey === this.publicKey)
			const { type, publicKey: publicKeyBytes } = decodeURI(payload.publicKey)
			assert(type === Secp256k1SignatureScheme.type)

			const signature = await this.#wallet.signTypedData({ name: topic }, Secp256k1DelegateSigner.eip712SessionTypes, {
				topic: topic,
				clock: clock,
				parents: parents,
				payload: {
					userAddress: address,
					publicKey: "0x" + SigningKey.computePublicKey(publicKeyBytes, false).slice(4),
					authorizationData: payload.authorizationData,
					duration: payload.context.duration ?? 0,
					timestamp: payload.context.timestamp,
					blockhash: payload.context.blockhash ?? "", // TODO: consider making blockhash mandatory for EIP-712?
				},
			})
			return { codec: codecs.session, publicKey: this.publicKey, signature: getBytes(signature) }
		} else {
			signalInvalidType(payload)
		}
	}

	public export(): { type: string; privateKey: Uint8Array } {
		return { type: Secp256k1SignatureScheme.type, privateKey: getBytes(this.#wallet.privateKey) }
	}
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

export const Secp256k1SignatureScheme: SignatureScheme<Action | Session<Eip712SessionData>> = {
	type: "secp256k1",
	codecs: [codecs.action, codecs.session],
	verify(signature: Signature, message: Message<Action | Session<Eip712SessionData>>) {
		const { type, publicKey } = decodeURI(signature.publicKey)
		assert(type === Secp256k1SignatureScheme.type)

		const sessionAddress = computeAddress(hexlify(publicKey))

		const { topic, clock, parents, payload } = message
		if (payload.type === "action") {
			assert(signature.codec === codecs.action, "expected signature.codec === codecs.action")

			const { address } = parseAddress(payload.did)
			const recoveredAddress = verifyTypedData(
				{ name: message.topic },
				Secp256k1DelegateSigner.eip712ActionTypes,
				{
					topic: topic,
					clock: clock,
					parents: parents,
					payload: {
						name: payload.name,
						args: getAbiString(payload.args),
						userAddress: address,
						timestamp: payload.context.timestamp,
						blockhash: payload.context.blockhash ?? "",
					},
				},
				hexlify(signature.signature),
			)

			assert(recoveredAddress === sessionAddress, "invalid EIP-712 action signature")
		} else if (payload.type === "session") {
			assert(signature.codec === codecs.session, "expected signature.codec === codecs.session")

			const { type, publicKey: publicKeyBytes } = decodeURI(payload.publicKey)
			assert(type === Secp256k1SignatureScheme.type)

			const { address } = parseAddress(payload.did)
			const recoveredAddress = verifyTypedData(
				{ name: message.topic },
				Secp256k1DelegateSigner.eip712SessionTypes,
				{
					topic: topic,
					clock: clock,
					parents: parents,
					payload: {
						userAddress: address,
						publicKey: "0x" + SigningKey.computePublicKey(publicKeyBytes, false).slice(4),
						authorizationData: payload.authorizationData,
						duration: payload.context.duration ?? 0,
						timestamp: payload.context.timestamp,
						blockhash: payload.context.blockhash ?? "",
					},
				},
				hexlify(signature.signature),
			)

			assert(recoveredAddress === sessionAddress, "invalid EIP-712 session signature")
		} else {
			signalInvalidType(payload)
		}
	},
	create(init) {
		return new Secp256k1DelegateSigner(init)
	},
}
