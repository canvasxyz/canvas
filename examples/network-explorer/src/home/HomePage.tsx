import useSWR from "swr"
import { Action, Session } from "@canvas-js/interfaces"
import { Link } from "react-router-dom"

import { version } from "../../package.json"
import ArgsPopout from "../components/ArgsPopout.js"
import { BASE_URL, Result, fetchAndIpldParseJson, formatDistanceCustom } from "../utils.js"

function HomePage() {
	const { data: countsData, error: countsError } = useSWR(
		"/index_api/counts",
		fetchAndIpldParseJson<
			{
				topic: string
				address_count: number
				session_count: number
				action_count: number
				connection_count: number
				connections: string[]
			}[]
		>,
		{
			refreshInterval: 1000,
		},
	)

	const { data, error } = useSWR("/index_api/messages", fetchAndIpldParseJson<Result<Action | Session>[]>, {
		refreshInterval: 1000,
	})

	if (error || countsError) return <div>failed to load</div>
	if (!data || !countsData) return <div>loading...</div>

	const actions = data.filter((item) => item.message.payload.type === "action") as Result<Action>[]

	return (
		<>
			<div className="flex flex-row bg-white rounded-lg drop-shadow p-4 px-5 gap-3">
				<div className="w-1/2">
					<div className="font-bold">Status</div>
					<div className="font-medium">Online, running v{version}</div>
					<div className="font-medium">{BASE_URL}</div>
				</div>
			</div>
			<div className="grid grid-cols-2 gap-4">
				<div className="flex flex-col gap-2">
					<div>Topics</div>
					<div className="border rounded-lg py-1">
						<table className="table-auto w-full rounded text-left rtl:text-right">
							<thead>
								<tr className="border-b">
									<th className="px-3 font-normal">Topic</th>
									<th className="px-3 font-normal">Messages</th>
									<th className="px-3 font-normal">Connections</th>
								</tr>
							</thead>
							<tbody>
								{countsData.map((row) => (
									<tr key={row.topic}>
										<td className="break-all px-3 py-2">
											<Link to={`topic/${row.topic}`}>{row.topic}</Link>
										</td>
										<td className="break-all px-3">{row.action_count + row.session_count}</td>
										<td className="break-all px-3">
											{row.connection_count} <ArgsPopout data={JSON.stringify(row.connections)} />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<div>Latest Actions</div>
					<div className="border rounded-lg py-1">
						<table className="table-auto w-full rounded text-left rtl:text-right">
							<thead>
								<tr className="border-b">
									<th className="px-3 font-normal">Address</th>
									<th className="px-3 font-normal">Action</th>
									<th className="px-1 font-normal">Args</th>
									<th className="px-3 font-normal">Timestamp</th>
								</tr>
							</thead>
							<tbody>
								{actions.map(({ id, message }) => {
									return (
										<tr key={id}>
											<td className="break-all px-3 py-2">{message.payload.did.slice(0, 20)}...</td>
											<td className="break-all px-3">{message.payload.name}</td>
											<td className="break-all px-1">
												<ArgsPopout data={JSON.stringify(message.payload.args)} />
											</td>
											<td className="break-all px-3">
												{formatDistanceCustom(message.payload.context.timestamp).replace("about ", "~")} ago
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</>
	)
}

export default HomePage
