import useSWR from "swr"

import { fetchAndIpldParseJson } from "./utils.js"
import { useEffect, useState } from "react"
import { Model } from "@canvas-js/modeldb"

export type ApplicationData = {
	networkConfig: {
		bootstrapList?: string[]
		listen?: string[]
		announce?: string[]
	}
	database: string
	topic: string
	models: Record<string, Model>
	actions: string[]
}

export const useApplicationData = () => {
	const [content, setContent] = useState<ApplicationData | null>(null)
	const { data } = useSWR(`/api/`, fetchAndIpldParseJson<ApplicationData>)

	useEffect(() => {
		if (data && data.content) {
			setContent(data.content)
		} else {
			setContent(null)
		}
	}, [data])

	return content
}
