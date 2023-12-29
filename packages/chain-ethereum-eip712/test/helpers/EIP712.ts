import { EIP712Domain, EIP712TypeDefinition, HardhatSignerType } from "./EIP712.types"

export async function signTypedData(
	domain: EIP712Domain,
	types: EIP712TypeDefinition,
	values: object,
	signer: HardhatSignerType,
) {
	try {
		const signature = await signer.signTypedData(domain, types, values)
		return signature
	} catch (error) {
		console.log("[signTypedData]::error ", error)
		return ""
	}
}
