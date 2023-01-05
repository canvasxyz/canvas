import type { Chain, ChainId } from "./contracts.js"

/**
 * An `ActionArgument` is type-level representation of concrete action argument
 * types, ie TypeScript types that describe the possible JavaScript values
 * that we put into and get out of action calls.
 *
 * The action timestamp may be expressed as a number or blockhash. We provide
 * `Block` for this. The action processor may choose to check `timestamp`
 * and/or `block` depending on which is provided.
 */
export type ActionArgument = null | boolean | number | string

export type Block = {
	chain: Chain
	chainId: ChainId
	blocknum: number
	blockhash: string
	timestamp: number
}

export interface BlockProvider {
	chain: Chain
	chainId: ChainId
	getBlock: (key: string | number) => Promise<Block>
	onBlock: (cb: (block: Block) => void) => void
	removeOnBlock: () => void
}

/**
 * An `ActionPayload` is the data signed by the user, either directly
 * or using a session key, to execute an action in a Canvas application.
 *
 * It is made of an `ActionContext` joined with `call` and `args`.
 */
export type ActionContext = {
	from: string
	spec: string
	timestamp: number
	chain: Chain
	chainId: ChainId
	blockhash: string | null
}

export type ActionPayload = ActionContext & {
	call: string
	args: Record<string, ActionArgument>
}

/**
 * An `Action` is an `ActionPayload` and a signature.
 */
export type Action = {
	type: "action"
	payload: ActionPayload
	session: string | null
	signature: string
}

export interface BlockProvider {
	chain: Chain
	chainId: ChainId

	getBlock: (key: number | string) => Promise<Block>
	onBlock: (cb: (block: Block) => void) => void
	removeOnBlock: () => void
}
