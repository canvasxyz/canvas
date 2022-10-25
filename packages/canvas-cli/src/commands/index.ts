import type { CommandModule } from "yargs"

import * as init from "./init.js"
import * as info from "./info.js"
import * as run from "./run.js"
import * as exportData from "./export.js"
import * as importData from "./import.js"
import * as list from "./list.js"
import * as install from "./install.js"

export const commands = [init, info, run, exportData, importData, list, install] as CommandModule[]
