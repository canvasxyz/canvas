import useSWR from "swr"
import { Action, Message, Session, Signature } from "@canvas-js/interfaces"
import { Result, fetchAndIpldParseJson, formatDistanceCustom } from "./utils.js"
import ArgsPopout from "./ArgsPopout.js"
import { TopicStats } from "./TopicStats.js"
import { useParams } from "react-router-dom"

function SessionField({ signature, message }: { signature: Signature; message: Message<Action> }) {
	const { data: session, error } = useSWR(
		`/index_api/latest_session/${message.topic}?address=${message.payload.address}&public_key=${signature.publicKey}`,
		fetchAndIpldParseJson<Session>,
	)

	if (error) return <span className="text-red-400">failed to load</span>

	return <span className="text-gray-400">{session && formatDistanceCustom(session.timestamp)} ago</span>
}

function Topic() {
	const { topic } = useParams()

	const { data, error } = useSWR(`/canvas_api/${topic}/messages`, fetchAndIpldParseJson<Result<Action | Session>[]>, {
		refreshInterval: 1000,
	})

	if (error || !topic) return <div>failed to load</div>
	if (!data) return <div>loading...</div>

	const sortedMessages = data.sort((a, b) => b[2].payload.timestamp - a[2].payload.timestamp)

	const actions = sortedMessages.filter((item) => item[2].payload.type === "action") as Result<Action>[]
	const sessions = sortedMessages.filter((item) => item[2].payload.type === "session") as Result<Session>[]

	return (
		<>
			<div className="text-white pt-5 text-lg font-bold">Topic Information</div>
			<TopicStats topic={topic} />
			<div className="flex flex-col gap-2">
				<div className="flex flex-col gap-1">
					<div className="text-sm">Latest Actions</div>
					<div>Action history for this topic, sorted by timestamp</div>
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
							{actions.map(([cid, signature, message]) => (
								<tr key={cid}>
									<td className="break-all px-6 py-2">{message.payload.address.slice(0, 15)}...</td>
									<td className="break-all px-6">{message.payload.name}</td>
									<td className="break-all px-6">
										<ArgsPopout data={JSON.stringify(message.payload.args)} />
									</td>
									<td className="break-all px-6">{formatDistanceCustom(message.payload.timestamp)} ago</td>
									<td className="break-all px-6">
										{signature.publicKey.slice(0, 25)}...
										<SessionField message={message} signature={signature} />
									</td>
									{/* <td className="break-all">{message.clock}</td> */}
									{/* <td className="break-all">{JSON.stringify(message.parents)}</td> */}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

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
								// const session = sessionsByAddress.get(message.payload.address)
								// const publicKey = session ? session.publicKey : ""

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
		</>
	)
}

export default Topic
