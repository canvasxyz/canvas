import fs from "node:fs"
import path from "node:path"
import os from "node:os"

import fetch from "node-fetch"

export const download = (multihash) =>
	fetch(`http://localhost:5001/api/v0/cat?arg=${multihash}`, { method: "POST" })
		.then((res) => res.text())
		.catch((err) => {
			if (err?.code === "ECONNREFUSED") {
				console.log("Could not connect to local IPFS daemon, try: ipfs daemon --offline")
				process.exit(1)
			} else {
				throw err
			}
		})

export const defaultDataDirectory = process.env.CANVAS_DATA_DIRECTORY ?? path.resolve(os.homedir(), ".canvas")

export function isMultihash(multihashOrPath) {
	return /^Qm[a-zA-Z0-9]{44}$/.test(multihashOrPath)
}

export function getDirectorySize(directory) {
	return fs.readdirSync(directory).reduce((totalSize, name) => {
		const file = path.resolve(directory, name)
		const stat = fs.statSync(file)
		if (stat.isDirectory()) {
			return totalSize + stat.size + getDirectorySize(file)
		} else {
			return totalSize + stat.size
		}
	}, 0)
}
