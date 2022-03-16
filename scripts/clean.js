import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import path from "node:path"
import fs from "node:fs"

fs.rmSync(path.resolve("db"), { recursive: true, force: true })
