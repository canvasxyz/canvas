import type { CommandModule } from "yargs"

import * as info from "./info.js"
import * as run from "./run.js"
import * as exportData from "./export.js"
import * as importData from "./import.js"

export const commands = [info, run, exportData, importData] as unknown as CommandModule[]
