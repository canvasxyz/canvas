import chalk from "chalk"
import type { Core } from "@canvas-js/core"
import { SessionExists, ActionExists } from "@canvas-js/core/utils"
import type { Action, Session } from "@canvas-js/interfaces"

// Types for returned JSON from the API
type AnyJson = boolean | number | string | null | JsonArray | JsonMap
interface JsonMap {
	[key: string]: AnyJson
}
interface JsonArray extends Array<AnyJson> {}

// Types for defining sync module structure
export type SyncModuleCursor = { next?: "string"; applied?: number }
export type SyncModuleApply = (hash: string, action: Action, session: Session) => void
export type SyncModuleExports = {
	api: string
	apiToPeerHandler: (response: AnyJson, apply: SyncModuleApply) => Promise<SyncModuleCursor>
	peerToApiHandler: ({ action, session }: { action: Action; session: Session }) => Promise<void>
}

let wrapper: { timer?: ReturnType<typeof setTimeout> } = {}

const getTimestamp = () => {
	const d = new Date()
	return `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`
}

export const setupSyncModule = (core: Core, { api, apiToPeerHandler, peerToApiHandler }: SyncModuleExports) => {
	const API_SYNC_DELAY = 5000

	const apply = async (hash: string, action: Action, session: Session) => {
		await core.apply(session).catch((err: any) => {
			if (err instanceof SessionExists) {
				console.log("Success: Already exists")
			} else {
				console.log(chalk.red(err.stack))
			}
		})
		await core.apply(action).catch((err: any) => {
			if (err instanceof ActionExists) {
				console.log("Success: Already exists")
			} else {
				console.log(chalk.red(err.stack))
			}
		})
	}

	const sync = (apiUrl = api) =>
		fetch(apiUrl)
			.then((res) => {
				if (!res.ok) {
					console.log(chalk.red("[canvas-cli] api-sync poll got error response"))
					return
				}
				res
					.json()
					.then(async (data) => {
						const result = await apiToPeerHandler(data, apply)
						if (!result?.next) {
							console.log(chalk.green(`[canvas-cli] [${getTimestamp()}] api-sync success: no new actions`))
							wrapper.timer = setTimeout(sync, API_SYNC_DELAY)
						} else {
							console.log(
								chalk.green(`[canvas-cli] [${getTimestamp()}] api-sync success: ${result.applied} new actions`)
							)
							sync(result.next)
						}
					})
					.catch((err) => {
						console.log(chalk.red("[canvas-cli] api-sync error:", err))
						wrapper.timer = setTimeout(sync, API_SYNC_DELAY)
					})
			})
			.catch((err) => {
				console.log(chalk.red("[canvas-cli] api-sync fetch failed:", api, err))
				wrapper.timer = setTimeout(sync, API_SYNC_DELAY)
			})

	console.log(chalk.green("[canvas-cli] api-sync starting:", api))
	sync()

	return wrapper
}
