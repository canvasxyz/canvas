import { parse } from "@ipld/dag-json"
import useSWR from "swr"

const fetchAndIpldParseJson = async (url) => {
	const response = await fetch(url)
	const json = await response.text()
	return parse(json)
}

export default function Home() {
	const { data, error } = useSWR("/api/messages", fetchAndIpldParseJson)

	if (error) return <div>failed to load</div>
	if (!data) return <div>loading...</div>

	return (
		<>
			<h1>Messages:</h1>
			<table>
				<thead>
					<td>cid</td>
					<td>topic</td>
					<td>type</td>
				</thead>
				<tbody>
					{data.map(({ cid, signature, message }) => (
						<tr key={cid}>
							<td>{cid}</td>
							<td>{message.topic}</td>
							<td>{message.payload.type}</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	)
}
