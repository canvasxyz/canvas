import { formatDistance } from "date-fns"
import { Message, Signature } from "@canvas-js/interfaces"
import { parse } from "@ipld/dag-json"

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || ""

export const fetchAsString = async (path: string) => {
	const response = await fetch(`${BASE_URL}${path}`)
	return await response.text()
}

export const fetchAndIpldParseJson = async <T>(path: string) => {
	const startTime = Date.now()
	const response = await fetch(`${BASE_URL}${path}`)
	const endTime = Date.now()
	const responseTime = endTime - startTime

	const json = await response.text()
	return { content: parse(json) as T, responseTime }
}
export type Result<T> = { id: string; signature: Signature; message: Message<T> }

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

export const formatTime = (ms: number) => {
	const s = Math.floor((ms / 1000) % 60);
	const m = Math.floor((ms / (1000 * 60)) % 60);
	const h = Math.floor((ms / (1000 * 60 * 60)) % 24);
	const d = Math.floor(ms / (1000 * 60 * 60 * 24));
	
	const parts = [
	  { value: d, label: 'd' },
	  { value: h, label: 'h' },
	  { value: m, label: 'm' },
	  { value: s, label: 's' }
	]
	.filter(part => part.value > 0)
	.map(part => part.value + part.label);
	
	return parts.length ? parts.join(' ') : '0s';
  }