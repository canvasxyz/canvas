import { Action, Message, Session, Signature } from "@canvas-js/interfaces"
import { parse } from "@ipld/dag-json"
import useSWR from "swr"

const fetchAndIpldParseJson = async (url) => {
	const response = await fetch(url)
	const json = await response.text()
	return parse(json)
}
type Result<T> = { cid: string; signature: Signature; message: Message<T> }

export default function Home() {
	const { data, error } = useSWR<Result<Action | Session>[]>("/api/messages", fetchAndIpldParseJson as any, {
		refreshInterval: 1000,
	})

	if (error) return <div>failed to load</div>
	if (!data) return <div>loading...</div>

	const actions = data.filter(({ message }) => message.payload.type === "action") as Result<Action>[]
	const sessions = data.filter(({ message }) => message.payload.type === "session") as Result<Session>[]

	return (
		<>
			<h1>Actions ({actions.length}):</h1>
			<table>
				<thead>
					<th>cid</th>
					<th>topic</th>
					<th>name</th>
					<th>args</th>
					<th>timestamp</th>
				</thead>
				<tbody>
					{actions.map(({ cid, signature, message }) => (
						<tr key={cid}>
							<td>{cid}</td>
							<td>{message.topic}</td>
							<td>{message.payload.name}</td>
							<td>{JSON.stringify(message.payload.args)}</td>
							<td>{message.payload.timestamp}</td>
						</tr>
					))}
				</tbody>
			</table>

			<h1>Sessions ({sessions.length}):</h1>
			<table>
				<thead>
					<th>cid</th>
					<th>topic</th>
					<th>address</th>
					<th>publicKey</th>
					<th>timestamp</th>
				</thead>
				<tbody>
					{sessions.map(({ cid, signature, message }) => (
						<tr key={cid}>
							<td>{cid}</td>
							<td>{message.topic}</td>
							<td>{message.payload.address}</td>
							<td>{message.payload.publicKey}</td>
							<td>{message.payload.timestamp}</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	)
}
