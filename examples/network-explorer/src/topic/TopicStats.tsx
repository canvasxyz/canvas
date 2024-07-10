import useSWR from "swr"
import { fetchAndIpldParseJson } from "../utils.js"

export function TopicStats({ topic }: { topic: string }) {
	const { data: countsData } = useSWR(
		`/index_api/counts/${topic}`,
		fetchAndIpldParseJson<{ topic: string; action_count: number; session_count: number; address_count: number }>,
		{
			refreshInterval: 1000,
		},
	)
	return (
		<div className="flex flex-row bg-white rounded-lg drop-shadow p-4 gap-3">
			<div>
				<div>Topic</div>
				<div className="font-bold">{topic}</div>
			</div>
			<div>
				<div>Actions</div>
				<div className="font-bold">{countsData ? countsData.action_count : "..."}</div>
			</div>
			<div>
				<div>Sessions</div>
				<div className="font-bold">{countsData ? countsData.session_count : "..."}</div>
			</div>
			<div>
				<div>Unique Addresses</div>
				<div className="font-bold">{countsData ? countsData.address_count : "..."}</div>
			</div>
		</div>
	)
}
