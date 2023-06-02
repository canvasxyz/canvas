import path from "node:path"
import fs from "node:fs"

import { config } from "dotenv"

config()

const { DATA_DIRECTORY, BOOTSTRAP_LIST, LISTEN, ANNOUNCE } = process.env

export const dataDirectory = DATA_DIRECTORY ?? path.resolve("data")

if (!fs.existsSync(dataDirectory)) {
	fs.mkdirSync(dataDirectory)
}

export const bootstrapList = BOOTSTRAP_LIST?.split(" ") ?? []

export const listenAddresses = LISTEN?.split(" ") ?? []

export const announceAddresses = ANNOUNCE?.split(" ") ?? []
