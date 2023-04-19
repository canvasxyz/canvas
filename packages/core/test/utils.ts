import Hash from "ipfs-only-hash"
import { ethers } from "ethers"
import { CID } from "multiformats"

import type {
	Action,
	ActionArgument,
	ActionPayload,
	Model,
	Query,
	RouteContext,
	Session,
	SessionPayload,
} from "@canvas-js/interfaces"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"

import type { ContractFunctionArgument, ContractFunctionResult } from "@canvas-js/core/components/vm"
import { assert } from "@canvas-js/core/utils"

type ValueTypes = {
	boolean: boolean
	string: string
	float: number
	integer: number
	datetime: number
}

type Values<M extends Model> = { [K in Exclude<keyof M, "indexes" | "id" | "updated_at">]: ValueTypes[M[K]] }
type Context<Models extends Record<string, Model>> = {
	timestamp: number
	hash: string
	from: string
	db: {
		[K in keyof Models]: {
			set: (id: string, values: Values<Models[K]>) => void
			delete: (id: string) => void
		}
	}
	contracts: Record<string, Record<string, (...args: ContractFunctionArgument[]) => Promise<ContractFunctionResult[]>>>
}

type ActionHandler<Models extends Record<string, Model>> = (
	args: Record<string, ActionArgument>,
	ctx: Context<Models>
) => void

// this is used for both `actions` and `sources`
function compileActionHandlers<Models extends Record<string, Model>>(actions: Record<string, ActionHandler<Models>>) {
	const entries = Object.entries(actions).map(([name, action]) => {
		assert(typeof action === "function")
		const source = action.toString()
		if (source.startsWith(`${name}(`) || source.startsWith(`async ${name}(`)) {
			return source
		} else {
			return `${name}: ${source}`
		}
	})

	return entries
}

export async function compileSpec<Models extends Record<string, Model>>(exports: {
	chains?: string[]
	models: Models
	actions: Record<string, ActionHandler<Models>>
	routes?: Record<string, (params: Record<string, string>, db: RouteContext) => Query>
	contracts?: Record<string, { chain: string; address: string; abi: string[] }>
	sources?: Record<string, Record<string, ActionHandler<Models>>>
}): Promise<{ app: string; cid: CID; spec: string }> {
	const { chains, models, actions, routes, contracts, sources } = exports

	const actionEntries = compileActionHandlers(actions)

	const routeEntries = Object.entries(routes || {}).map(([name, route]) => {
		assert(typeof route === "function")
		const source = route.toString()
		if (source.startsWith(`${name}(`) || source.startsWith(`async ${name}(`)) return source
		return `\t"${name}": ${source}`
	})

	const lines = [
		`export const chains = ${JSON.stringify(chains ?? ["eip155:1"])};`,
		`export const models = ${JSON.stringify(models, null, "\t")};`,
		`export const actions = {\n${actionEntries.join(",\n")}};`,
	]

	if (routes !== undefined) {
		lines.push(`export const routes = {\n${routeEntries.join(",\n")}};`)
	}

	if (contracts !== undefined) {
		lines.push(`export const contracts = ${JSON.stringify(contracts, null, "\t")};`)
	}

	if (sources !== undefined) {
		lines.push(`export const sources = {`)
		for (const [uri, actions] of Object.entries(sources)) {
			const entries = compileActionHandlers(actions)
			lines.push(`\t["${uri}"]: {\n${entries.map((line) => `\t\t${line}`).join(",\n")}\n\t},`)
		}
		lines.push(`};`)
	}

	const spec = lines.join("\n")
	const cid = await Hash.of(spec)
	return { app: `ipfs://${cid}`, cid: CID.parse(cid), spec }
}

export class TestSigner {
	readonly wallet = ethers.Wallet.createRandom()
	private timestamp = Date.now()

	constructor(
		readonly uri: string,
		readonly chainImplementation: EthereumChainImplementation = new EthereumChainImplementation()
	) {}

	async sign(call: string, callArgs: Record<string, ActionArgument>): Promise<Action> {
		const actionPayload: ActionPayload = {
			from: this.wallet.address,
			app: this.uri,
			call,
			callArgs,
			timestamp: this.timestamp++,
			chain: this.chainImplementation.chain,
			block: null,
		}

		if (this.chainImplementation.provider !== undefined) {
			const block = await this.chainImplementation.provider.getBlock("latest")
			assert(block !== null)

			actionPayload.block = block.hash
		}

		return this.chainImplementation.signAction(this.wallet, actionPayload)
	}
}

export class TestSessionSigner {
	readonly wallet = ethers.Wallet.createRandom()
	private timestamp = Date.now()

	constructor(readonly signer: TestSigner) {}

	async session(): Promise<Session> {
		const sessionPayload: SessionPayload = {
			sessionAddress: this.wallet.address,
			sessionDuration: 60 * 60 * 24 * 1000,
			sessionIssued: this.timestamp++,
			from: this.signer.wallet.address,
			app: this.signer.uri,
			chain: this.signer.chainImplementation.chain,
			block: null,
		}

		if (this.signer.chainImplementation.provider !== undefined) {
			const block = await this.signer.chainImplementation.provider.getBlock("latest")
			assert(block !== null)

			sessionPayload.block = block.hash
		}

		return await this.signer.chainImplementation.signSession(this.signer.wallet, sessionPayload)
	}

	async sign(call: string, callArgs: Record<string, ActionArgument>): Promise<Action> {
		const actionPayload: ActionPayload = {
			from: this.signer.wallet.address,
			app: this.signer.uri,
			call,
			callArgs,
			timestamp: this.timestamp++,
			chain: this.signer.chainImplementation.chain,
			block: null,
		}

		if (this.signer.chainImplementation.provider !== undefined) {
			const block = await this.signer.chainImplementation.provider.getBlock("latest")
			assert(block !== null)

			actionPayload.block = block.hash
		}

		return await this.signer.chainImplementation.signDelegatedAction(this.wallet, actionPayload)
	}
}

export async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
	const array: T[] = []
	for await (const value of iter) {
		array.push(value)
	}

	return array
}

export async function* map<I, O>(iter: AsyncIterable<I>, f: (value: I) => O): AsyncIterable<O> {
	for await (const value of iter) {
		yield f(value)
	}
}
