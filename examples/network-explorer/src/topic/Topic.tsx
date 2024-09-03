import { useParams } from "react-router-dom"
import useSWR from "swr"

import { fetchAndIpldParseJson } from "../utils.js"
import ActionsTable from "./ActionsTable.js"
import SessionsTable from "./SessionsTable.js"

function Topic() {
	const { topic } = useParams()

	if (!topic) {
		// TODO: 404 page
		return <div>Topic not found</div>
	}

	const { data: countsData } = useSWR(
		`/index_api/counts/${topic}`,
		fetchAndIpldParseJson<{ topic: string; action_count: number; session_count: number; address_count: number }>,
		{
			refreshInterval: 1000,
		},
	)

	return (
		<>
			<div className="flex flex-row bg-white rounded-lg drop-shadow p-4 gap-3">
				<div>
					<div className="font-bold">Topic</div>
					<div className="font-medium">{topic}</div>
				</div>
				<div>
					<div className="font-bold">Messages</div>
					<div className="font-medium">{countsData ? countsData.action_count + countsData.session_count : "..."}</div>
				</div>
				<div>
					<div className="font-bold">Addresses</div>
					<div className="font-medium">{countsData ? countsData.address_count : "..."}</div>
				</div>
			</div>
			<ActionsTable topic={topic} />
			<SessionsTable topic={topic} />
		</>
	)
}

export default Topic
