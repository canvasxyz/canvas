import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import path from "node:path"
import fs from "node:fs"

import * as IpfsHttpClient from "ipfs-http-client"

// connect to the default API address http://localhost:5001
const ipfs = IpfsHttpClient.create()

fs.mkdirSync(path.resolve("db"))

const specNamePattern = /^[a-z]+\.canvas\.js$/
const [preloadSpecs] = process.argv.slice(2)

if (preloadSpecs !== undefined) {
	for (const name of fs.readdirSync(preloadSpecs)) {
		if (!specNamePattern.test(name)) {
			continue
		}

		const preloadSpecPath = path.resolve(preloadSpecs, name)
		const content = fs.readFileSync(preloadSpecPath)
		const { cid } = await ipfs.add(content, { onlyHash: true })
		const multihash = cid.toString()
		fs.mkdirSync(path.resolve("db", multihash))
		fs.copyFileSync(preloadSpecPath, path.resolve("db", multihash, "spec.js"))
	}
}
