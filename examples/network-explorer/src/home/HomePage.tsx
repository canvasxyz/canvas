import useSWR from "swr"
import { Action, Session } from "@canvas-js/interfaces"
import { Link } from "react-router-dom"

import ArgsPopout from "../components/ArgsPopout.js"
import { NetworkStats } from "./NetworkStats.js"
import { Result, fetchAndIpldParseJson, formatDistanceCustom } from "../utils.js"

function HomePage() {
	//
	const { data: countsData, error: countsError } = useSWR(
		"/index_api/counts",
		fetchAndIpldParseJson<{ topic: string; address_count: number; session_count: number; action_count: number }[]>,
		{
			refreshInterval: 1000,
		},
	)

	const { data, error } = useSWR("/index_api/messages", fetchAndIpldParseJson<Result<Action | Session>[]>, {
		refreshInterval: 1000,
	})

	if (error || countsError) return <div>failed to load</div>
	if (!data || !countsData) return <div>loading...</div>

	const actions = data.filter((item) => item[2].payload.type === "action") as Result<Action>[]

	return (
		<>
			<div className="text-white pt-6">
				This explorer provides information about signed interactions on Canvas topics.
			</div>
			<NetworkStats />
			<div className="grid grid-cols-2 gap-4">
				<div className="flex flex-col gap-2">
					<div>
						<div className="font-bold">Topics</div>
						<div>Each topic must be configured manually at this time</div>
					</div>
					<div className="border rounded-lg py-1">
						<table className="table-auto w-full rounded text-left rtl:text-right">
							<thead>
								<tr className="border-b">
									<th className="px-3 font-normal">Topic</th>
									<th className="px-3 font-normal">Actions</th>
									<th className="px-3 font-normal">Sessions</th>
									<th className="px-3 font-normal">Addresses</th>
								</tr>
							</thead>
							<tbody>
								{countsData.map((row) => (
									<tr key={row.topic}>
										<td className="break-all px-3 py-2">
											<Link to={`topic/${row.topic}`}>{row.topic}</Link>
										</td>
										<td className="break-all px-3">{row.action_count}</td>
										<td className="break-all px-3">{row.session_count}</td>
										<td className="break-all px-3">{row.address_count}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<div>
						<div className="font-bold">Latest Actions</div>
						<div>Live feed of recent actions, for all topics</div>
					</div>
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
								{actions.map((item) => {
									const cid = item[0]
									const message = item[2]

									return (
										<tr key={cid}>
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
