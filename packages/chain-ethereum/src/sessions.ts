import { SessionPayload } from "@canvas-js/interfaces"
import { ethers } from "ethers"
import siwe from "siwe"

export const SiweMessageVersion = "1"

const chainPattern = /^eip155:(\d+)$/

export function createSiweMessage(payload: SessionPayload, domain: string, nonce: string): string {
	const chainPatternMatch = chainPattern.exec(payload.chain)
	if (chainPatternMatch === null) {
		throw new Error(`invalid chain: ${payload.chain} did not match ${chainPattern}`)
	}

	const [_, chainId] = chainPatternMatch

	const message = new siwe.SiweMessage({
		version: SiweMessageVersion,
		domain: domain,
		nonce: nonce,
		address: payload.from,
		uri: `ethereum:${payload.sessionAddress}`, // switch to CAIP once they have a URI spec
		chainId: parseInt(chainId),
		issuedAt: new Date(payload.sessionIssued).toISOString(),
		expirationTime: new Date(payload.sessionIssued + payload.sessionDuration).toISOString(),
		resources: [payload.app],
	})

	return message.prepareMessage()
}

export async function signSessionPayload(
	signer: ethers.Signer,
	payload: SessionPayload,
	domain: string
): Promise<string> {
	const signerAddress = await signer.getAddress()
	if (signerAddress !== payload.from) {
		throw new Error(`Unexpected signer address: expected ${payload.from}, got ${signerAddress}`)
	}

	const nonce = siwe.generateNonce()
	const message = createSiweMessage(payload, domain, nonce)

	const signature = await signer.signMessage(message)
	return `${domain}:${nonce}:${signature}`
}

const signaturePattern = /^([A-Za-z0-9\-._~!$&'()*+,;=]+):([A-Za-z0-9]+):(0x[A-Fa-f0-9]+)$/

export async function verifySessionSignature(payload: SessionPayload, signature: string): Promise<void> {
	const signaturePatternMatch = signaturePattern.exec(signature)
	if (signaturePatternMatch === null) {
		throw new Error(`Invalid signature: signature did not match ${signaturePattern}`)
	}

	const [_, domain, nonce, signatureData] = signaturePatternMatch

	const message = createSiweMessage(payload, domain, nonce)

	const recoveredAddress = await ethers.utils.verifyMessage(message, signatureData)
	if (recoveredAddress !== payload.from) {
		throw new Error(`Invalid session signature: expected ${payload.from}, recovered ${recoveredAddress}`)
	}
}
