import fs from "node:fs"

import * as IpfsHttpClient from "ipfs-http-client"
import Hash from "ipfs-only-hash"

export const getSpec = async (multihashOrPath) => {
	let multihash, spec
	if (multihashOrPath.match(/^Qm[a-zA-Z0-9]+/)) {
		// fetch spec from multihash
		multihash = multihashOrPath

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
