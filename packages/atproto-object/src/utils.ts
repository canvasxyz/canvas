import type { AtInit, AtConfig } from "./types.js"

export const isStringArray = (arr: unknown): arr is string[] => {
	return Array.isArray(arr) && arr.every((item: unknown) => typeof item === "string")
}

// Translate init syntaxes into a map of AtConfigs
export const getConfig = (init: AtInit): Record<string, AtConfig> => {
	if (!Array.isArray(init)) {
		return Object.fromEntries(
			Object.entries(init).map(([table, config]) => {
				return [table, typeof config === "string" ? { nsid: config } : config]
			})
		)
	} else if (isStringArray(init)) {
		return Object.fromEntries(init.map((nsid: string) => [nsid, { nsid }]))
	} else {
		return Object.fromEntries(init.map(({ table, $type }) => [table, { nsid: $type }]))
	}
}

export const findPdsEndpoint = async function(did: string, log?: (message: string, ...args: any[]) => void): Promise<string | null> {
	try {
		if (did.startsWith("did:plc:")) {
			const plcUrl = `https://plc.directory/${did}`
			const response = await fetch(plcUrl, {
				method: "GET",
				headers: { "User-Agent": "AtObject/1.0" },
				signal: AbortSignal.timeout(5000),
			})

			if (response.ok) {
				const didDoc = await response.json()
				if (didDoc.service) {
					for (const service of didDoc.service) {
						if (service.id === "#atproto_pds" && service.serviceEndpoint) {
							return service.serviceEndpoint
						}
					}
				}
			}
		}

		if (did.startsWith("did:web:")) {
			const domain = did.replace("did:web:", "").replace(/:/g, "/")
			const webUrl = `https://${domain}/.well-known/did.json`
			const response = await fetch(webUrl, {
				method: "GET",
				headers: { "User-Agent": "AtObject/1.0" },
				signal: AbortSignal.timeout(5000),
			})

			if (response.ok) {
				const didDoc = await response.json()
				if (didDoc.service) {
					for (const service of didDoc.service) {
						if (service.id === "#atproto_pds" && service.serviceEndpoint) {
							return service.serviceEndpoint
						}
					}
				}
			}
		}
	} catch (error) {
		log?.("Error resolving DID %s: %O", did, error)
		return null
	}
	return null
}