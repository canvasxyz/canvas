/**
 * A `Chain` is a string representation of a type of chain.
 */
export type Chain = "eth" | "cosmos" | "solana" | "substrate" | "near"

export type ChainId = string

/**
 * A `ContractMetadata` defines the metadata for a contract read by a
 * Canvas spec. Metadatas should be sufficiently generalizable to
 * refer to contracts on many different chains and chain architectures.
 *
 * By default we support Ethereum-based chains with chain = `eth`,
 * and an ethers.js-style human readable ABI.
 *
 * Note that `chainId` must be a string.
 */
export type ContractMetadata = {
	chain: Chain
	chainId: string
	address: string
	abi: string[]
}
