// import chalk from "chalk"
// import type { Core } from "@canvas-js/core"
// import { AlreadyExists } from "@canvas-js/core/utils"
// import type { Action, Session } from "@canvas-js/interfaces"

// // Types for returned JSON from the API
// type AnyJson = boolean | number | string | null | JsonArray | JsonMap
// interface JsonMap {
// 	[key: string]: AnyJson
// }
// interface JsonArray extends Array<AnyJson> {}

// // Types for defining sync module structure
// export type SyncModuleCursor = { next?: "string"; applied?: number; count?: number }
// export type SyncModuleApply = (hash: string, action: Action, session: Session) => Promise<boolean>
// export type SyncModuleExports = {
// 	api: string
// 	apiToPeerHandler: (response: AnyJson, apply: SyncModuleApply) => Promise<SyncModuleCursor>
// 	peerToApiHandler: ({ action, session }: { action: Action; session: Session }) => Promise<void>
// }

// const wrapper: { timer?: ReturnType<typeof setTimeout> } = {}

// const getTimestamp = () => {
// 	const d = new Date()
// 	return `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`
// }

// export const setupSyncModule = (core: Core, { api, apiToPeerHandler, peerToApiHandler }: SyncModuleExports) => {
// 	const API_SYNC_DELAY = 5000

// 	const apply = async (hash: string, action: Action, session: Session): Promise<boolean> => {
// 		// apply session, don't throw errors or return (to wait for action application)
// 		await core.apply(session, true).catch((err: any) => {
// 			if (!(err instanceof AlreadyExists)) {
// 				console.log(chalk.red(`[canvas-cli] [${getTimestamp()}] error executing session: ${err.message}`))
// 			}
// 		})
// 		// apply action, always resolve promise at the end
// 		return new Promise((resolve, reject) => {
// 			core
// 				.apply(action, true)
// 				.then(() => resolve(true))
// 				.catch((err: any) => {
// 					if (!(err instanceof AlreadyExists)) {
// 						console.log(chalk.red(`[canvas-cli] [${getTimestamp()}] error executing action: ${err.message}`))
// 						// don't throw - nodes may have accepted invalid actions due to various stateful reasons,
// 						// e.g. lack of session expiration checks
// 					}
// 					resolve(false)
// 				})
// 		})
// 	}

// 	const sync = (apiUrl = api) => {
// 		console.log(apiUrl)
// 		fetch(apiUrl)
// 			.then((res) => {
// 				if (!res.ok) {
// 					console.log(chalk.red("[canvas-cli] api-sync poll got error response"))
// 					return
// 				}
// 				res
// 					.json()
// 					.then(async (data) => {
// 						const result = await apiToPeerHandler(data, apply)
// 						if (!result?.applied) {
// 							const len = result?.count
// 							console.log(chalk.green(`[canvas-cli] [${getTimestamp()}] api-sync: no new actions (of ${len})`))
// 							wrapper.timer = setTimeout(sync, API_SYNC_DELAY)
// 						} else {
// 							const len = result?.count
// 							console.log(
// 								chalk.green(`[canvas-cli] [${getTimestamp()}] api-sync: ${result.applied} new actions (of ${len})`)
// 							)
// 							if (result?.next) {
// 								wrapper.timer = setTimeout(() => sync(result.next), 500)
// 							} else {
// 								wrapper.timer = setTimeout(sync, API_SYNC_DELAY)
// 							}
// 						}
// 					})
// 					.catch((err) => {
// 						console.log(chalk.red("[canvas-cli] api-sync error:", err.message))
// 						wrapper.timer = setTimeout(sync, API_SYNC_DELAY)
// 					})
// 			})
// 			.catch((err) => {
// 				console.log(chalk.red("[canvas-cli] api-sync fetch failed:", api, err))
// 				wrapper.timer = setTimeout(sync, API_SYNC_DELAY)
// 			})
// 	}

// 	console.log(chalk.green("[canvas-cli] api-sync starting:", api))
// 	sync()

// 	return wrapper
// }
