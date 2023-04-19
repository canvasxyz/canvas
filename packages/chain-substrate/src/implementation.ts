import { InjectedExtension } from "@polkadot/extension-inject/types"

import { Keyring } from "@polkadot/api"
import { stringToHex } from "@polkadot/util"
import { mnemonicGenerate, signatureVerify } from "@polkadot/util-crypto"

import {
	Action,
	ActionPayload,
	ChainImplementation,
	Session,
	SessionPayload,
	serializeActionPayload,
	serializeSessionPayload,
} from "@canvas-js/interfaces"

type ExtensionAndAddress = { extension: InjectedExtension; address: string }
type SubstrateMnemonic = string

const genesisHashPattern = /^0x[a-f0-9]{64}$/

/**
 * Substrate chain export.
 */
export class SubstrateChainImplementation implements ChainImplementation<ExtensionAndAddress, SubstrateMnemonic> {
	public readonly chain: string

	constructor(
		public readonly genesisHash: string = "0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3"
	) {
		if (!genesisHashPattern.test(genesisHash)) {
			throw new Error(`invalid genesis hash: ${genesisHash} does not match ${genesisHashPattern}`)
		}

		// https://github.com/ChainAgnostic/namespaces/blob/main/polkadot/caip2.md
		this.chain = `polkadot:${genesisHash.slice(2, 34)}`
	}

	hasProvider() {
		return false
	}

	async verifyAction(action: Action): Promise<void> {
		const signerAddress = action.session ?? action.payload.from
		const message = serializeActionPayload(action.payload)
		const signatureBytes = Buffer.from(action.signature.slice(2), "hex")
		const valid = signatureVerify(message, signatureBytes, signerAddress).isValid
		if (!valid) {
			throw new Error("Invalid action signature")
		}
	}

	async verifySession(session: Session): Promise<void> {
		const message = serializeSessionPayload(session.payload)
		const signatureBytes = Buffer.from(session.signature.slice(2), "hex")
		const valid = signatureVerify(message, signatureBytes, session.payload.from).isValid
		if (!valid) {
			throw new Error("Invalid action signature")
		}
	}

	getSignerAddress = async ({ address }: ExtensionAndAddress) => address

	getDelegatedSignerAddress = async (mnemonic: SubstrateMnemonic) => {
		const keyring: Keyring = new Keyring({ ss58Format: 42 })
		const pair = keyring.addFromUri(mnemonic, {}) // use sr25519 by default
		return pair.address
	}

	async signSession({ extension, address }: ExtensionAndAddress, payload: SessionPayload): Promise<Session> {
		if (extension.signer.signRaw === undefined) throw new Error("Invalid signer")
		const message = stringToHex(serializeSessionPayload(payload))
		const signature = (
			await extension.signer.signRaw({
				address,
				data: message,
				type: "bytes",
			})
		).signature
		const session: Session = { type: "session", payload, signature }
		return session
	}

	async signAction({ extension, address }: ExtensionAndAddress, payload: ActionPayload): Promise<Action> {
		if (extension.signer.signRaw === undefined) throw new Error("Invalid signer")
		const message = stringToHex(serializeActionPayload(payload))
		const signature = (
			await extension.signer.signRaw({
				address,
				data: message,
				type: "bytes",
			})
		).signature
		const action: Action = { type: "action", payload, session: null, signature }
		return action
	}

	async signDelegatedAction(mnemonic: SubstrateMnemonic, payload: ActionPayload) {
		const keyring: Keyring = new Keyring({ ss58Format: 42 })
		const pair = keyring.addFromUri(mnemonic, {}) // use sr25519 by default
		const message = serializeActionPayload(payload)
		const signatureBytes = pair.sign(message)
		const signature = Buffer.from(signatureBytes).toString("hex")

		const action: Action = {
			type: "action",
			payload: payload,
			session: pair.address,
			signature: `0x${signature}`,
		}
		return action
	}

	importDelegatedSigner = (mnemonic: string) => mnemonic
	exportDelegatedSigner = (mnemonic: SubstrateMnemonic) => mnemonic
	generateDelegatedSigner = async (): Promise<SubstrateMnemonic> => mnemonicGenerate()

	async getLatestBlock(): Promise<string> {
		throw new Error("Not implemented")
	}
}
