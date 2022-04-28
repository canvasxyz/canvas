import fs from "node:fs"
import path from "path"

import * as IpfsHttpClient from "ipfs-http-client"
import Hash from "ipfs-only-hash"

export const getSpec = async (datadir, multihashOrPath) => {
	let multihash, spec
	if (multihashOrPath.match(/^Qm[a-zA-Z0-9]+/)) {
		multihash = multihashOrPath

		// check the datadir for a matching spec
		try {
			const spec = fs.readFileSync(path.resolve(datadir, multihash, "spec.mjs")).toString()
			const fileHash = await Hash.of(spec)
			if (fileHash !== multihash) {
				console.log("Found an existing spec.mjs, but it did not match the multihash.")
				throw new Error()
			}
			return { multihash, spec }
		} catch (err) {
			console.log(err)
		}

		console.log("Fetching spec from IPFS. This requires a local IPFS daemon...")

		// fetch spec from multihash
		const chunks = []
		try {
			const ipfs = await IpfsHttpClient.create()
			for await (const chunk of ipfs.cat(multihash)) {
				chunks.push(chunk)
			}
		} catch (err) {
			if (err.message.indexOf("ECONNREFUSED") !== -1) {
				console.log("Could not connect to local IPFS daemon, try: ipfs daemon --offline")
			}
			throw err
		}
		spec = Buffer.concat(chunks).toString("utf-8")
	} else {
		// read spec from file
		const bytes = fs.readFileSync(multihashOrPath)
		multihash = await Hash.of(bytes)
		spec = bytes.toString()
	}

	return { multihash, spec }
}
