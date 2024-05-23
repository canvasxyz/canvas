import useSWR from "swr"
import { Action, Session } from "@canvas-js/interfaces"
import { Link } from "react-router-dom"
import ArgsPopout from "./ArgsPopout"
import { Result, fetchAndIpldParseJson, formatDistanceCustom } from "./utils"
import { NetworkStats } from "./NetworkStats"

function HomePage() {
	const { data, error } = useSWR("/api/messages", fetchAndIpldParseJson<Result<Action | Session>[]>, {
		refreshInterval: 1000,
	})

	if (error) return <div>failed to load</div>
	if (!data) return <div>loading...</div>

	const actions = data.filter((item) => item[2].payload.type === "action") as Result<Action>[]

	return (
		<>
			<div className="text-white pt-5">
				This explorer provides information about signed interactions on Canvas applications.
			</div>
			<NetworkStats />
			<div className="grid grid-cols-2 gap-4">
				<div className="flex flex-col gap-2">
					<div>
						<div className="font-bold">Applications</div>
						<div>Each application must be configured manually at this time</div>
					</div>
					<div className="border rounded-lg py-1">
						<table className="table-auto w-full rounded text-left rtl:text-right">
							<thead>
								<tr className="border-b">
									<th className="px-3 font-normal">Application</th>
									<th className="px-3 font-normal">Actions</th>
									<th className="px-3 font-normal">Sessions</th>
									<th className="px-3 font-normal">Addresses</th>
								</tr>
							</thead>
							<tbody>
								<tr key={"chat-example.canvas.xyz"}>
									<td className="break-all px-3 py-2">
										<Link to="application/1">{"chat-example.canvas.xyz"}</Link>
									</td>
									<td className="break-all px-3">{1538}</td>
									<td className="break-all px-3">{445}</td>
									<td className="break-all px-3">{48}</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<div>
						<div className="font-bold">Latest Actions</div>
						<div>Live feed of recent actions, for all applications</div>
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
											<td className="break-all px-3 py-2">{message.payload.address.slice(0, 20)}...</td>
											<td className="break-all px-3">{message.payload.name}</td>
											<td className="break-all px-1">
												<ArgsPopout data={JSON.stringify(message.payload.args)} />
											</td>
											<td className="break-all px-3">
												{formatDistanceCustom(message.payload.timestamp).replace("about ", "~")} ago
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
