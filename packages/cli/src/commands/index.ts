import type { CommandModule } from "yargs"

import * as init from "./init.js"
import * as info from "./info.js"
import * as run from "./run.js"
import * as exportData from "./export.js"
// import * as importData from "./import.js"

// export const commands = [init, info, run, exportData, importData] as CommandModule[]
export const commands = [init, info, run, exportData] as unknown as CommandModule[]
