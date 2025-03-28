import { GossipLog as IdbGossipLog } from "@canvas-js/gossiplog/idb"

import type { PlatformTarget } from "../interface.js"

import esbuild from "esbuild-wasm"

const target: PlatformTarget = {
	openGossipLog: ({ path }, init) => {
		return IdbGossipLog.open(init)
	},

	async listen(app, port, options) {
		throw new Error("Cannot start API server in the browser")
	},

	async buildContract(contract: string) {
		try {
			await esbuild.initialize({
				worker: true,
				wasmURL: "https://unpkg.com/esbuild-wasm@0.25.1/esbuild.wasm",
			})
		} catch (err) {
			// initialize should only be called once
		}

		const { code, warnings } = await esbuild.transform(contract, {
			loader: "tsx",
			format: "esm",
		})
		for (const warning of warnings) {
			const location = warning.location ? ` (${warning.location.line}:${warning.location.column})` : ""
			console.log(`esbuild warning: ${warning.text}${location}`)
		}

		return code
	},

	async buildContractByLocation(location: string) {
		throw new Error("Unimplemented: buildContractByLocation in browser")
	},
}

export default target
