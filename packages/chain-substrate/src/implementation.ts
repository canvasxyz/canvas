import type {
	Action,
	ActionPayload,
	Chain,
	ChainId,
	ChainImplementation,
	Session,
	SessionPayload,
} from "@canvas-js/interfaces"
import { serializeActionPayload, serializeSessionPayload } from "@canvas-js/interfaces"
import { InjectedExtension } from "@polkadot/extension-inject/types"

import { Keyring } from "@polkadot/api"
import { mnemonicGenerate, signatureVerify } from "@polkadot/util-crypto"
import { stringToHex } from "@polkadot/util"

const getActionSignatureData = (payload: ActionPayload): string => {
	return serializeActionPayload(payload)
}
const getSessionSignatureData = (payload: SessionPayload): string => {
	return serializeSessionPayload(payload)
}
export type ExtensionAndAddress = { extension: InjectedExtension; address: string }
type SubstrateMnemonic = string

/**
 * Substrate chain export.
 */
export class SubstrateChainImplementation implements ChainImplementation<ExtensionAndAddress, SubstrateMnemonic> {
	public readonly chain: Chain = "substrate"
	private keyring: Keyring = new Keyring({ ss58Format: 42 })

	constructor(public readonly chainId: ChainId = "mainnet") {}

	async verifyAction(action: Action): Promise<void> {
		const signerAddress = action.session ?? action.payload.from
		const message = getActionSignatureData(action.payload)
		const signatureBytes = new Buffer(action.signature, "hex")
		const valid = signatureVerify(message, signatureBytes, signerAddress).isValid
		if (!valid) {
			throw new Error("Invalid action signature")
		}
	}

	async verifySession(session: Session): Promise<void> {
		const message = getSessionSignatureData(session.payload)
		const signatureBytes = new Buffer(session.signature.slice(2), "hex")
		const valid = signatureVerify(message, signatureBytes, session.payload.from).isValid
		if (!valid) {
			throw new Error("Invalid action signature")
		}
	}

	getSignerAddress = async ({ extension, address }: ExtensionAndAddress) => {
		return address
	}
	getDelegatedSignerAddress = async (mnemonic: SubstrateMnemonic) => {
		const keyring: Keyring = new Keyring({ ss58Format: 42 })
		const pair = keyring.addFromUri(mnemonic, {}) // use sr25519 by default
		return pair.address
	}

	isSigner(signer: unknown): signer is ExtensionAndAddress {
		return typeof signer !== "string"
	}

	isDelegatedSigner(signer: unknown): signer is SubstrateMnemonic {
		return typeof signer === "string"
	}

	async signSession({ extension, address }: ExtensionAndAddress, payload: SessionPayload): Promise<Session> {
		if (extension.signer.signRaw === undefined) throw new Error("Invalid signer")
		const message = stringToHex(getSessionSignatureData(payload))
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
		const message = stringToHex(getActionSignatureData(payload))
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
		const message = getActionSignatureData(payload)
		const signatureBytes = pair.sign(message)
		const signature = new Buffer(signatureBytes).toString("hex")

		const action: Action = {
			type: "action",
			payload: payload,
			session: pair.address,
			signature,
		}
		return action
	}

	importDelegatedSigner = (mnemonic: string) => mnemonic
	exportDelegatedSigner = (mnemonic: SubstrateMnemonic) => mnemonic
	generateDelegatedSigner = async (): Promise<SubstrateMnemonic> => mnemonicGenerate()

	async getLatestBlock(): Promise<string> {
		throw new Error("Unimplemented")
	}
}
