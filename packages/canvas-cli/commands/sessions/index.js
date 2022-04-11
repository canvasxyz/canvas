import * as ls from "./ls.js"

export const command = "sessions <command>"
export const desc = "Manage app sessions"
export const builder = function (yargs) {
	return yargs.command([ls]).recommendCommands().strict().demandCommand(1, "")
}
