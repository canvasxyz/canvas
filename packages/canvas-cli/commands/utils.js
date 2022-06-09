import fs from "node:fs"
import path from "node:path"
import os from "node:os"

import fetch from "node-fetch"
import Hash from "ipfs-only-hash"
import prompt from "prompt"

async function resetAppData(appPath) {
	const hypercorePath = path.resolve(appPath, "hypercore")
	const databasePath = path.resolve(appPath, "db.sqlite")
	if (fs.existsSync(hypercorePath) || fs.existsSync(databasePath)) {
		const { reset } = await prompt.get({
			name: "reset",
			description: `${chalk.yellow(`Do you want to ${chalk.bold("erase all data")} in ${appPath}?`)} [yN]`,
			message: "Invalid input.",
			type: "string",
			required: true,
			pattern: /^[yn]?$/i,
		})

		if (reset.toLowerCase() === "y") {
			console.log(`[canvas-cli]: Removing ${hypercorePath}`)
			fs.rmSync(hypercorePath, { recursive: true, force: true })
			console.log(`[canvas-cli]: Removing ${databasePath}`)
			fs.rmSync(databasePath, { recursive: true, force: true })
		} else {
			console.log("[canvas-cli]: Cancelled.")
			process.exit(1)
		}
	}
}

export const downloadSpec = async (specParam, datadir, reset) => {
	if (!fs.existsSync(datadir)) {
		fs.mkdirSync(datadir)
	}

	prompt.message = "[canvas-cli]"
	prompt.start()

	let appPath
	let spec
	if (isMultihash(specParam)) {
		appPath = path.resolve(datadir, specParam)
		if (fs.existsSync(appPath)) {
			spec = fs.readFileSync(path.resolve(appPath, "spec.mjs"), "utf-8")
			if (reset) {
				await resetAppData(appPath)
			}
		} else {
			console.log("Creating", appPath)
			fs.mkdirSync(appPath)
			console.log("Downloading", specParam, "from IPFS...")
			spec = await download(specParam)
			fs.writeFileSync(path.resolve(appPath, "spec.mjs"), spec)
			fs.writeFileSync(path.resolve(appPath, "spec.cid"), specParam)
		}
	} else {
		spec = fs.readFileSync(specParam, "utf-8")
		const multihash = await Hash.of(spec)
		appPath = path.resolve(datadir, multihash)
		if (fs.existsSync(appPath)) {
			if (reset) {
				await resetAppData(appPath)
			}
		} else {
			console.log("Creating", appPath)
			fs.mkdirSync(appPath)
			fs.writeFileSync(path.resolve(appPath, "spec.mjs"), spec)
			fs.writeFileSync(path.resolve(appPath, "spec.cid"), multihash)
		}
	}

	return [appPath, spec]
}

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
