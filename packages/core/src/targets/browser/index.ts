import { GossipLog as IdbGossipLog } from "@canvas-js/gossiplog/idb"

import type { PlatformTarget } from "../interface.js"

import esbuild from "esbuild-wasm"

type BuildContractConfig = { wasmURL: string }

const target: PlatformTarget = {
	openGossipLog: ({ path }, init) => {
		return IdbGossipLog.open(init)
	},

	async listen(app, port, options) {
		throw new Error("Cannot start API server in the browser")
	},

	async buildContract(contract: string, extraConfig?: BuildContractConfig) {
		if (!extraConfig || !extraConfig.wasmURL) {
			throw new Error("must provide esbuild wasmURL to build contracts inside the browser ")
		}

		try {
			const { wasmURL } = extraConfig
			await esbuild.initialize({
				worker: true,
				wasmURL,
			})
		} catch (err: any) {
			if (err?.message?.startsWith("Failed to download")) throw err
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
}

export default target
