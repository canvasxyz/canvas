import useSWR from "swr"
import { fetchAndIpldParseJson } from "../utils.js"
import { version } from "../../package.json"

export function NetworkStats() {
	const { data } = useSWR(
		"/index_api/counts/total",
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
		<div className="flex flex-row bg-white rounded-lg drop-shadow p-4 px-5 gap-3">
			<div className="w-1/2">
				<div className="font-bold">Status</div>
				<div className="font-medium">Online, running Canvas {version}</div>
			</div>
			<div>
				<div className="w-24 font-bold">Messages</div>
				<div className="font-medium">{data ? data.action_count + data.session_count : "..."}</div>
			</div>
			<div>
				<div className="w-24 font-bold">Addresses</div>
				<div className="font-medium">{data ? data.address_count : "..."}</div>
			</div>
		</div>
	)
}
