import { Action, Session } from "@canvas-js/interfaces"
import { fetchAndIpldParseJson, Result } from "../utils.js"
import useSWR from "swr"
import { NetworkChart } from "./computeNetworkPlot.js"

export default function NetworkPlot({ topic }: { topic: string }) {
	const { data: messages } = useSWR(
		`/index_api/messages/${topic}?limit=all`,
		fetchAndIpldParseJson<Result<Action | Session>[]>,
		{
			refreshInterval: 1000,
		},
	)

	const visualisationData = messages
		? messages.map((result) => ({
				...result.message,
				branch: result.branch,
				id: result.id,
		  }))
		: []

	return <NetworkChart data={visualisationData} />
}
