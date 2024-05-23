import useSWR from "swr"
import { fetchAndIpldParseJson } from "./utils"

export function NetworkStats() {
	const { data } = useSWR(
		"/api/counts/total",
		fetchAndIpldParseJson<{
			action_count: number
			session_count: number
			address_count: number
		}>,
		{
			refreshInterval: 1000,
		},
	)

	return (
		<div className="flex flex-row bg-white rounded-lg drop-shadow p-3 gap-3">
			<div>
				<div className="font-bold">Network Status</div>
				<div>Explorer is online, running node v0.9.1</div>
			</div>
			<div>
				<div>Observed Actions</div>
				<div className="font-bold">{data ? data.action_count : "..."}</div>
			</div>
			<div>
				<div>Observed Sessions</div>
				<div className="font-bold">{data ? data.session_count : "..."}</div>
			</div>
			<div>
				<div>Unique Addresses</div>
				<div className="font-bold">{data ? data.address_count : "..."}</div>
			</div>
		</div>
	)
}
