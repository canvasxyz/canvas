import useSWR from "swr"
import { Action, Message, Session, Signature } from "@canvas-js/interfaces"
import { parse } from "@ipld/dag-json"

const fetchAndIpldParseJson = async <T,>(path: string) => {
	const response = await fetch(`http://localhost:3000${path}`)
	const json = await response.text()
	return parse(json) as T
}
type Result<T> = [string, Signature, Message<T>]

function App() {
	const { data, error } = useSWR("/api/messages", fetchAndIpldParseJson<Result<Action | Session>[]>, {
		refreshInterval: 1000,
	})

	const { data: connectionsData, error: connectionsError } = useSWR(
		"/api/connections",
		fetchAndIpldParseJson<Record<string, { peer: string; addr: string; streams: Record<string, string | null> }>>,
		{
			refreshInterval: 1000,
		},
	)

	const { data: clockData, error: clockError } = useSWR(
		"/api/clock",
		fetchAndIpldParseJson<{ clock: number; parents: string[] }>,
		{
			refreshInterval: 1000,
		},
	)

	if (error || connectionsError || clockError) return <div>failed to load</div>
	if (!data || !connectionsData || !clockData) return <div>loading...</div>

	const connectionsDataKeys = Object.keys(connectionsData)
	connectionsDataKeys.sort()

	const actions = data.filter((item) => item[2].payload.type === "action") as Result<Action>[]
	const sessions = data.filter((item) => item[2].payload.type === "session") as Result<Session>[]

	return (
		<>
			Clock: {clockData.clock} <br />
			<h1>Actions ({actions.length}):</h1>
			<table>
				<thead>
					<tr>
						<th>cid</th>
						<th>topic</th>
						<th>name</th>
						<th>args</th>
						<th>timestamp</th>
					</tr>
				</thead>
				<tbody>
					{actions.map((item) => {
						const cid = item[0]
						const message = item[2]
						return (
							<tr key={cid}>
								<td>{cid}</td>
								<td>{message.topic}</td>
								<td>{message.payload.name}</td>
								<td>{JSON.stringify(message.payload.args)}</td>
								<td>{message.payload.timestamp}</td>
							</tr>
						)
					})}
				</tbody>
			</table>
			<h1>Sessions ({sessions.length}):</h1>
			<table>
				<thead>
					<tr>
						<th>cid</th>
						<th>topic</th>
						<th>address</th>
						<th>publicKey</th>
						<th>timestamp</th>
					</tr>
				</thead>
				<tbody>
					{sessions.map((item) => {
						const cid = item[0]
						const message = item[2]
						return (
							<tr key={cid}>
								<td>{cid}</td>
								<td>{message.topic}</td>
								<td>{message.payload.address}</td>
								<td>{message.payload.publicKey}</td>
								<td>{message.payload.timestamp}</td>
							</tr>
						)
					})}
				</tbody>
			</table>
			<h1>Connections ({connectionsDataKeys.length}):</h1>
			<table>
				<thead>
					<tr>
						<th>addr</th>
						<th>peer</th>
					</tr>
				</thead>
				<tbody>
					{connectionsDataKeys.map((connectionKey) => {
						const { addr, peer } = connectionsData[connectionKey]
						return (
							<tr key={connectionKey}>
								<td>{addr.split("/").slice(0, -1).join("/")}/...</td>
								<td>{peer}</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</>
	)
}

export default App
