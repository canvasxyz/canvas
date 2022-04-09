import * as ls from "./ls.js"

export const command = "action <command>"
export const desc = "Manage app actions"
export const builder = function (yargs) {
	return yargs.command([ls]).recommendCommands().strict().demandCommand(1, "")
}
