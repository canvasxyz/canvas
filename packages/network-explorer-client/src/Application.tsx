import useSWR from "swr"
import { Action, Session } from "@canvas-js/interfaces"
import { Result, fetchAndIpldParseJson } from "./utils"
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

			<div>
				<div className="text-sm font-bold">Latest Actions</div>
				<div>Action history for this application, sorted by timestamp</div>
				<table className="table-auto">
					<thead>
						<tr>
							<th>Address</th>
							<th>Action</th>
							<th>Args</th>
							<th>Timestamp</th>
							<th>Session</th>
							<th>Received (clock)</th>
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
									<td>{message.payload.address.slice(0, 20)}...</td>
									<td>{message.payload.name}</td>
									<td>
										<ArgsPopout data={JSON.stringify(message.payload.args)} />
									</td>
									<td>{message.payload.timestamp}</td>
									<td>
										{publicKey ? `${publicKey.slice(0, 25)}...` : "-"}{" "}
										<span className="text-gray-400">{session && session.timestamp}</span>
									</td>
									<td>{message.clock}</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		</>
	)
}

export default Application
