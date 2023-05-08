import chalk from "chalk"
import type { Core } from "@canvas-js/core"
import { SessionExists, ActionExists } from "@canvas-js/core/utils"
import type { Action, Session } from "@canvas-js/interfaces"

// Types for returned JSON from the API
type AnyJson =  boolean | number | string | null | JsonArray | JsonMap;
interface JsonMap {  [key: string]: AnyJson; }
interface JsonArray extends Array<AnyJson> {}

// Types for defining sync module structure
export type SyncModuleCursor = { next?: "string" }
export type SyncModuleApply = (hash: string, action: Action, session: Session) => void
export type SyncModuleExports = {
  api: string,
  apiToPeerHandler: (response: AnyJson, apply: SyncModuleApply) => Promise<SyncModuleCursor>
  peerToApiHandler: (action: Action, session: Session) => Promise<void>
}

let wrapper: { timer?: ReturnType<typeof setTimeout> } = {}

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

	const sync = () => fetch(api)
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
						console.log(chalk.green("[canvas-cli] api-sync: no new actions" + ` (${data.result?.length})`))
					} else {
						console.log(chalk.green("[canvas-cli] api-sync: synced new actions"))
						// TODO: continue fetching data with cursor
					}
		      setTimeout(sync, API_SYNC_DELAY)
				})
				.catch((err) => {
					console.log(chalk.red("[canvas-cli] api-sync error:", err))
		      setTimeout(sync, API_SYNC_DELAY)
				})
		})
		.catch((err) => {
      console.log(chalk.red("[canvas-cli] fetch failed:", api))
		  setTimeout(sync, API_SYNC_DELAY)
    })

	console.log(chalk.green("[canvas-cli] api-sync polling:", api))
	sync()

  return wrapper
}
