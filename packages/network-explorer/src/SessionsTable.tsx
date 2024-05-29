import useSWR from "swr"
import { Session } from "@canvas-js/interfaces"
import { Result, fetchAndIpldParseJson, formatDistanceCustom } from "./utils.js"
import PaginationButton from "./PaginationButton.js"
import useCursorStack from "./useCursorStack.js"

const entriesPerPage = 10

function SessionsTable({ topic }: { topic: string }) {
	const { currentCursor, pushCursor, popCursor } = useCursorStack<string>()

	// in order to determine if another page exists, we retrieve n + 1 entries
	// if the length of the result is n + 1, then there is another page
	const params = new URLSearchParams({
		type: "session",
		order: "desc",
		limit: (entriesPerPage + 1).toString(),
	})
	if (currentCursor) {
		params.append("lt", currentCursor)
	}

	const { data: sessions, error } = useSWR(
		`/canvas_api/${topic}/messages?${params.toString()}`,
		fetchAndIpldParseJson<Result<Session>[]>,
		{
			refreshInterval: 1000,
		},
	)

	if (error) return <div>failed to load</div>
	if (!sessions) return <div>loading...</div>

	const sessionsToDisplay = sessions.slice(0, entriesPerPage)
	const hasMore = sessions.length > entriesPerPage

	return (
		<div className="flex flex-col gap-2 pb-4">
			<div className="flex flex-col gap-1">
				<div className="text-sm">Sessions</div>
				<div>Sessions that have been created for this topic, sorted by timestamp</div>
			</div>
			<div className="border rounded-lg py-1">
				<table className="table-auto w-full rounded text-left rtl:text-right">
					<thead>
						<tr className="border-b">
							<th className="px-6 font-normal">Public Key</th>
							<th className="px-6 font-normal">Address</th>
							<th className="px-6 font-normal">Timestamp</th>
						</tr>
					</thead>
					<tbody>
						{sessionsToDisplay.map((item) => {
							const cid = item[0]
							const message = item[2]

							return (
								<tr key={cid}>
									<td className="break-all px-6 py-2">{message.payload.publicKey}</td>
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
			<div className="flex flex-row gap-2">
				<div className="flex-grow"></div>
				<PaginationButton text="Previous" enabled={currentCursor !== null} onClick={popCursor} />
				<PaginationButton
					text="Next"
					enabled={hasMore}
					onClick={() => pushCursor(sessionsToDisplay[sessionsToDisplay.length - 1][0])}
				/>
			</div>
		</div>
	)
}

export default SessionsTable
