import useSWR from "swr"
import { Session } from "@canvas-js/interfaces"
import { Result, fetchAndIpldParseJson, formatDistanceCustom } from "./utils.js"

function SessionsTable({ topic }: { topic: string }) {
	const { data: sessions, error } = useSWR(
		`/canvas_api/${topic}/messages?type=action`,
		fetchAndIpldParseJson<Result<Session>[]>,
		{
			refreshInterval: 1000,
		},
	)

	if (error) return <div>failed to load</div>
	if (!sessions) return <div>loading...</div>

	return (
		<div className="flex flex-col gap-2 pb-4">
			<div className="flex flex-col gap-1">
				<div className="text-sm">Sessions</div>
				<div>Sessions that have been created for this topic, sorted by timestamp</div>
			</div>
			<div className="border rounded-lg py-1">
				<table className="table-auto w-full rounded text-left rtl:text-right">
					<thead>
						<tr className="border-b">
							<th className="px-6 font-normal">Address</th>
							<th className="px-6 font-normal">Timestamp</th>
						</tr>
					</thead>
					<tbody>
						{sessions.map((item) => {
							const cid = item[0]
							const message = item[2]

							return (
								<tr key={cid}>
									<td className="break-all px-6 py-2">{message.payload.address}</td>
									<td className="break-all px-6">
										<span className="text-gray-400">{formatDistanceCustom(message.payload.timestamp)} ago</span>
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		</div>
	)
}

export default SessionsTable
