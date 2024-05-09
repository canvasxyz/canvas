import { formatDistance } from "date-fns"
import { Message, Signature } from "@canvas-js/interfaces"
import { parse } from "@ipld/dag-json"

export const fetchAndIpldParseJson = async <T>(path: string) => {
	const response = await fetch(`http://localhost:3000${path}`)
	const json = await response.text()
	return parse(json) as T
}
export type Result<T> = [string, Signature, Message<T>]

export const formatDistanceCustom = (timestamp: number) => {
	return formatDistance(timestamp, new Date(), { includeSeconds: true })
}
