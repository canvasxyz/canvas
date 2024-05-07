import useSWR from "swr"
import { Action, Session } from "@canvas-js/interfaces"
import { Link } from "react-router-dom"
import ArgsPopout from "./ArgsPopout"
import Navbar from "./Navbar"
import { Result, fetchAndIpldParseJson } from "./utils"

function HomePage() {
	const { data, error } = useSWR("/api/messages", fetchAndIpldParseJson<Result<Action | Session>[]>, {
		refreshInterval: 1000,
	})

	if (error) return <div>failed to load</div>
	if (!data) return <div>loading...</div>

	const actions = data.filter((item) => item[2].payload.type === "action") as Result<Action>[]

	return (
		<>
			<Navbar />
			<div className="max-w-4xl bg-green-100">
				This explorer provides information about signed interactions on Canvas applications.
			</div>
			<div className="flex flex-row max-w-4xl bg-red-100 gap-3">
				<div>
					<div className="font-bold">Network Status</div>
					<div>Explorer is online, running node v0.9.1</div>
				</div>
				<div>
					<div>Observed Actions</div>
					<div className="font-bold">3,842</div>
				</div>
				<div>
					<div>Observed Sessions</div>
					<div className="font-bold">1,445</div>
				</div>
				<div>
					<div>Unique Addresses</div>
					<div className="font-bold">1,110</div>
				</div>
			</div>
			<div className="grid grid-cols-2 max-w-4xl">
				<div>
					<div>
						<div className="font-bold">Applications</div>
						<div>Each application must be configured manually at this time</div>
					</div>
					<table>
						<thead>
							<tr>
								<th>Application</th>
								<th>Actions</th>
								<th>Sessions</th>
								<th>Addresses</th>
							</tr>
						</thead>
						<tbody>
							<tr key={"chat-example.canvas.xyz"}>
								<td>
									<Link to="application/1">{"chat-example.canvas.xyz"}</Link>
								</td>
								<td>{1538}</td>
								<td>{445}</td>
								<td>{48}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div>
					<div>
						<div className="font-bold">Latest Actions</div>
						<div>Live feed of recent actions, for all applications</div>
					</div>
					<table>
						<thead>
							<tr>
								<th>Address</th>
								<th>Action</th>
								<th>Args</th>
								<th>Timestamp</th>
							</tr>
						</thead>
						<tbody>
							{actions.map((item) => {
								const cid = item[0]
								const message = item[2]

								return (
									<tr key={cid}>
										<td>{message.payload.address.slice(0, 20)}...</td>
										<td>{message.payload.name}</td>
										<td>
											<ArgsPopout data={JSON.stringify(message.payload.args)} />
										</td>
										<td>{message.payload.timestamp}</td>
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

export default HomePage
