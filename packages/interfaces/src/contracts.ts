/**
 * A `Chain` is a string representation of a type of chain.
 */
export type Chain = "eth" | "cosmos" | "solana" | "substrate" | "near"

export type ChainId = number | string

/**
 * A `ContractMetadata` defines the metadata for a contract read by a
 * Canvas spec. Metadatas should be sufficiently generalizable to
 * refer to contracts on many different chains and chain architectures.
 *
 * By default we support Ethereum-based chains with chain = `eth`,
 * a numerical chainId, and an ethers.js-style human readable ABI.
 */
export type ContractMetadata = {
	chain: Chain
	chainId: ChainId
	address: string
	abi: string[]
}
