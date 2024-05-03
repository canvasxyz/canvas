import useSWR from "swr"

export default function Home() {
	const { data, error } = useSWR("/api/messages", (url) => fetch(url).then((res) => res.json()))
	if (error) return <div>failed to load</div>
	if (!data) return <div>loading...</div>

	return (
		<>
			<h1>Messages:</h1>
			<table>
				{data.map(({ cid, signature, message }) => (
					<div key={cid}>{cid}</div>
				))}
			</table>
		</>
	)
}
