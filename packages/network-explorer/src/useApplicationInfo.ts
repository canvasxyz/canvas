import useSWR from "swr"
import type { Model } from "@canvas-js/modeldb"
import { fetchAndIpldParseJson } from "./utils.js"
import { useEffect, useState } from "react"

type ApplicationInfo = { topic: string; database: string; models: Record<string, Model> }

export const useApplicationInfo = () => {
	const [content, setContent] = useState<ApplicationInfo | null>(null)
	const { data } = useSWR(`/api/`, fetchAndIpldParseJson<ApplicationInfo>)

	useEffect(() => {
		if (data && data.content) {
			setContent(data.content)
		} else {
			setContent(null)
		}
	}, [data])

	return content
}
