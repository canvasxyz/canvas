import { formatDistance } from "date-fns"
import { Message, Signature } from "@canvas-js/interfaces"
import { parse } from "@ipld/dag-json"

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3333"

export const fetchAndIpldParseJson = async <T>(path: string) => {
	const response = await fetch(`${BASE_URL}${path}`)
	const json = await response.text()
	return parse(json) as T
}
export type Result<T> = [string, Signature, Message<T>]

export const formatDistanceCustom = (timestamp: number) => {
	let result = formatDistance(timestamp, new Date(), { includeSeconds: true })
	// make the formatted distance more concise
	// TODO: find a library with a "short form" humanized time distance
	result = result.replace("less than", "<")
	result = result.replace("about", "")
	result = result.replace("seconds", "sec")
	result = result.replace("minutes", "min")
	result = result.replace("a minute", "1 min")
	result = result.replace("minute", "min")
	return result
}
