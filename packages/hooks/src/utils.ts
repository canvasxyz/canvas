import { ActionArgument, Block, Chain, ChainId, ModelValue } from "@canvas-js/interfaces"

export const getCanvasSessionKey = (address: string) => `CANVAS_SESSION:${address}`

export type Dispatch = (call: string, args: Record<string, ActionArgument>) => Promise<{ hash: string }>

// Copied from https://github.com/jfromaniello/url-join/blob/main/lib/url-join.js

function normalize(strArray: string[]) {
	const resultArray = []
	if (strArray.length === 0) {
		return ""
	}

	if (typeof strArray[0] !== "string") {
		throw new TypeError("Url must be a string. Received " + strArray[0])
	}

	// If the first part is a plain protocol, we combine it with the next part.
	if (strArray[0].match(/^[^/:]+:\/*$/) && strArray.length > 1) {
		strArray[0] = strArray.shift() + strArray[0]
	}

	// There must be two or three slashes in the file protocol, two slashes in anything else.
	if (strArray[0].match(/^file:\/\/\//)) {
		strArray[0] = strArray[0].replace(/^([^/:]+):\/*/, "$1:///")
	} else {
		strArray[0] = strArray[0].replace(/^([^/:]+):\/*/, "$1://")
	}

	for (let i = 0; i < strArray.length; i++) {
		let component = strArray[i]

		if (typeof component !== "string") {
			throw new TypeError("Url must be a string. Received " + component)
		}

		if (component === "") {
			continue
		}

		if (i > 0) {
			// Removing the starting slashes for each component but the first.
			component = component.replace(/^[\/]+/, "")
		}
		if (i < strArray.length - 1) {
			// Removing the ending slashes for each component but the last.
			component = component.replace(/[\/]+$/, "")
		} else {
			// For the last component we will combine multiple slashes to a single one.
			component = component.replace(/[\/]+$/, "/")
		}

		resultArray.push(component)
	}

	let str = resultArray.join("/")
	// Each input component is now separated by a single slash except the possible first plain protocol part.

	// remove trailing slash before parameters or hash
	str = str.replace(/\/(\?|&|#[^!])/g, "$1")

	// replace ? in parameters with &
	const parts = str.split("?")
	str = parts.shift() + (parts.length > 0 ? "?" : "") + parts.join("&")

	return str
}

export function urlJoin(...args: string[]) {
	const parts = Array.from(Array.isArray(args[0]) ? args[0] : args)
	return normalize(parts)
}

export function compareObjects(a: Record<string, ModelValue>, b: Record<string, ModelValue>) {
	for (const key in a) {
		if (a[key] !== b[key]) {
			return false
		}
	}

	for (const key in b) {
		if (b[key] !== a[key]) {
			return false
		}
	}
	return true
}

export async function getRecentBlock(host: string, chain: Chain, chainId: ChainId): Promise<Block> {
	const res = await fetch(urlJoin(host, "latest_block", chain, chainId.toString()), { method: "GET" })
	const block = await res.json()
	// ethereum returns the chain id as a string but we are using a number (1, 5, etc)
	// this line replaces the chainId that comes from the API with our own chainId
	return { ...block, chainId }
}
