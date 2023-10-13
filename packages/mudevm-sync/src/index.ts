import { useEffect, useState } from "react"
import { type AbiItem, type Hex, GetContractReturnType, Abi, PublicClient, WalletClient, Address } from "viem"
import type { AbiFunction, AbiParameter, AbiType, SolidityTuple, SolidityArrayWithTuple } from "abitype"
import { ethers } from "ethers"

import { Canvas, ActionImplementation } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { typeOf, JSObject, JSValue } from "@canvas-js/vm"
import { PropertyType } from "@canvas-js/modeldb"

import type { MUDCoreUserConfig } from "@latticexyz/config"
import type { ExpandMUDUserConfig } from "@latticexyz/store/ts/register/typeExtensions"
import type { WorldConfig, WorldUserConfig } from "@latticexyz/world/ts/library/config/types"

import { abiTypeToModelType, encode } from "./utils.js"

export function useCanvas<
	TWorldContract extends GetContractReturnType<TAbi, TPublicClient, TWalletClient, TAddress>,
	TAbi extends Abi,
	TPublicClient extends Partial<PublicClient>,
	TWalletClient extends Partial<WalletClient>,
	TAddress extends Address
>(props: {
	world: {
		mudConfig: WorldUserConfig
		worldContract: TWorldContract
		publicClient: PublicClient
		getPrivateKey: () => Promise<Hex>
		systemAbis: Record<string, () => Promise<string>>
	}
	offline: boolean
}) {
	const [app, setApp] = useState<Canvas>()
	const mudConfig = props.world.mudConfig as ExpandMUDUserConfig<MUDCoreUserConfig> & WorldConfig

	useEffect(() => {
		const buildContract = async () => {
			const { offline, world } = props

			const models = Object.entries(mudConfig.tables).filter(
				([tableName, params]) => params.offchainOnly === true /* && params.offchainSync === true */
			)
			if (models.length === 0) {
				throw new Error("No offchain-synced tables defined")
			}

			const systems = Object.entries(mudConfig.systems).filter(
				([systemName, params]) => true /* params.offchainSync === true */
			)
			if (models.length === 0) {
				throw new Error("No offchain-synced systems defined")
			}

			// build models
			const modelsSpec = Object.fromEntries(
				models.map(([name, params]) => [
					name,
					{
						...Object.fromEntries(
							Object.entries(params.valueSchema).map(([field, type]) => [field, abiTypeToModelType(type)])
						),
						_key: "string" as PropertyType,
						_timestamp: "integer" as PropertyType,
					},
				])
			)

			// build actions
			const actionsSpec = {}
			const globs = Object.fromEntries(
				Object.entries(world.systemAbis).map(([key, value]) => {
					const filename = key.match(/\w+\.abi\.json$/)![0]
					return [filename, value]
				})
			)

			for (const [name] of systems) {
				const systemAbiRaw = await globs[`${name}.abi.json`]()
				const systemAbi = typeof systemAbiRaw === "string" ? JSON.parse(systemAbiRaw) : systemAbiRaw

				const calls = systemAbi.filter(
					(entry: AbiItem) =>
						entry.type === "function" && !entry.name.startsWith("_") && entry.name !== "supportsInterface"
				)

				const actions = Object.fromEntries(
					calls.map((abiParams: AbiFunction) => {
						const actionHandler: ActionImplementation = async (db, args = {} as { [s: string]: JSValue }, context) => {
							return new Promise((resolve, reject) => {
								const tableName = abiParams.outputs[0].internalType?.replace(/^struct /, "").replace(/Data$/, "")
								if (tableName === undefined) return reject()
								if (typeOf(args) !== "Object" || args === null) return reject() // TODO: JSObject typeguard

								const { publicClient, worldContract } = props.world
								publicClient
									.simulateContract({
										account: context.address as Hex,
										address: worldContract.address as Hex,
										abi: worldContract.abi,
										functionName: abiParams.name as any,
										args: abiParams.inputs.map((item) => (args as JSObject)[item.name as string]),
										gasPrice: 0n,
									})
									.then((data) => {
										const result = data.result as { [s: string]: unknown }

										// Gather and execute effects, one effect at a time for now
										const outputs = abiParams.outputs[0] as AbiParameter & {
											type: SolidityTuple | SolidityArrayWithTuple
											components: readonly AbiParameter[]
										}
										const values = outputs.components.map((c) => result[c.name!])
										const key = context.id
										// TODO: use key = keccak256(encodeAbiParameters(outputs.components, values))

										const modelValue = Object.fromEntries(
											Object.entries(result)
												.map(([name, value]) => [
													name,
													encode(
														value as string | bigint,
														outputs.components.find((c) => c.name === name)?.type as AbiType
													),
												])
												.concat([
													["_key", context.id],
													["_timestamp", context.timestamp],
												])
										)
										db[tableName].set(key, modelValue)
										resolve(modelValue)
									})
									.catch((err: Error) => {
										reject(err)
									})
							})
						}

						return [abiParams.name, actionHandler]
					})
				)
				Object.assign(actionsSpec, actions)
			}

			// TODO: viem to ethers requires us to get the private key, we should make SIWESigner accept viem
			const privateKey = await props.world.getPrivateKey()
			const wallet = new ethers.Wallet(privateKey)

			// create application
			const topic = `world.contract-${props.world.worldContract.address.toLowerCase()}`
			const app = await Canvas.initialize({
				contract: {
					topic,
					models: modelsSpec,
					actions: actionsSpec,
				},
				offline,
				signers: [new SIWESigner({ signer: wallet as any })],
				location: "sqldb",
			})
			setApp(app)
		}

		buildContract()
	}, [props.world.worldContract.address, props.offline])

	return app
}
