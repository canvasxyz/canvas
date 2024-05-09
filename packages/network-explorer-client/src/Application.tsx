import useSWR from "swr"
import { Action, Session } from "@canvas-js/interfaces"
import { Result, fetchAndIpldParseJson, formatDistanceCustom } from "./utils"
import ArgsPopout from "./ArgsPopout"

function Application() {
	const { data, error } = useSWR("/api/messages", fetchAndIpldParseJson<Result<Action | Session>[]>, {
		refreshInterval: 1000,
	})

	if (error) return <div>failed to load</div>
	if (!data) return <div>loading...</div>

	const actions = data.filter((item) => item[2].payload.type === "action") as Result<Action>[]

	const sessionsByAddress = new Map<string, Session>()
	for (const line of data) {
		const { payload } = line[2]
		if (payload.type === "session") {
			const sessionIfExists = sessionsByAddress.get(payload.address)
			if (!sessionIfExists || sessionIfExists.timestamp < payload.timestamp) {
				sessionsByAddress.set(payload.address, payload)
			}
		}
	}

	return (
		<>
			<div className="text-white pt-5 text-lg font-bold">Application Information</div>

			<div className="flex flex-row bg-white rounded-lg drop-shadow p-3 gap-3">
				<div>
					<div>Topic</div>
					<div className="font-bold">chat-example.canvas.xyz</div>
				</div>
				<div>
					<div>Actions</div>
					<div className="font-bold">1,155</div>
				</div>
				<div>
					<div>Sessions</div>
					<div className="font-bold">128</div>
				</div>
				<div>
					<div>Unique Addresses</div>
					<div className="font-bold">45</div>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<div className="flex flex-col gap-1">
					<div className="text-sm">Latest Actions</div>
					<div>Action history for this application, sorted by timestamp</div>
				</div>
				<div className="border rounded-lg py-1">
					<table className="table-auto w-full rounded text-left rtl:text-right">
						<thead>
							<tr className="border-b">
								<th className="px-6 font-normal">Address</th>
								<th className="px-6 font-normal">Action</th>
								<th className="px-6 font-normal">Args</th>
								<th className="px-6 font-normal">Timestamp</th>
								<th className="px-6 font-normal">Session</th>
								{/* <th>Received (clock)</th>
								<th>Parents</th> */}
							</tr>
						</thead>
						<tbody>
							{actions.map((item) => {
								const cid = item[0]
								const message = item[2]
								const session = sessionsByAddress.get(message.payload.address)
								const publicKey = session ? session.publicKey : ""

								return (
									<tr key={cid}>
										<td className="break-all px-6 py-2">{message.payload.address.slice(0, 15)}...</td>
										<td className="break-all px-6">{message.payload.name}</td>
										<td className="break-all px-6">
											<ArgsPopout data={JSON.stringify(message.payload.args)} />
										</td>
										<td className="break-all px-6">{formatDistanceCustom(message.payload.timestamp)} ago</td>
										<td className="break-all px-6">
											{publicKey ? `${publicKey.slice(0, 25)}...` : "-"}{" "}
											<span className="text-gray-400">{session && formatDistanceCustom(session.timestamp)} ago</span>
										</td>
										{/* <td className="break-all">{message.clock}</td> */}
										{/* <td className="break-all">{JSON.stringify(message.parents)}</td> */}
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			</div>
		</>
	)
}

export default Application
