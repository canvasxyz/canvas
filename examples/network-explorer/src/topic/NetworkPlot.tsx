import { Action } from "@canvas-js/interfaces"
import { fetchAndIpldParseJson, Result } from "../utils.js"
import useSWR from "swr"
import { NetworkChart } from "./computeNetworkPlot.js"

export default function NetworkPlot({ topic }: { topic: string }) {
	const { data: actions } = useSWR(`/index_api/messages/${topic}`, fetchAndIpldParseJson<Result<Action>[]>, {
		refreshInterval: 1000,
	})
	console.log(actions)

	const visualisationData = actions
		? actions.map((result) => ({
				branch: result.branch,
				id: result.id,
				clock: result.message.clock,
				parents: result.message.parents,
				effects: [],
		  }))
		: []

	return <NetworkChart data={visualisationData} />
}
