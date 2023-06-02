import path from "node:path"
import fs from "node:fs"

const { DATA_DIRECTORY } = process.env

export const dataDirectory = DATA_DIRECTORY ?? path.resolve("data")

if (!fs.existsSync(dataDirectory)) {
	fs.mkdirSync(dataDirectory)
}
