import useSWR from "swr"
import ArgsPopout from "./ArgsPopout.js"
import { Result, fetchAndIpldParseJson, formatDistanceCustom } from "./utils.js"
import { Action, Message, Session, Signature } from "@canvas-js/interfaces"
import { useState } from "react"

function SessionField({ signature, message }: { signature: Signature; message: Message<Action> }) {
	const { data: session, error } = useSWR(
		`/index_api/latest_session/${message.topic}?address=${message.payload.address}&public_key=${signature.publicKey}`,
		fetchAndIpldParseJson<Session>,
	)

	if (error) return <span className="text-red-400">failed to load</span>

	return <span className="text-gray-400"> {session && formatDistanceCustom(session.timestamp)} ago</span>
}

const entriesPerPage = 10

function PaginationButton({ text, onClick, enabled }: { text: string; enabled: boolean; onClick: () => void }) {
	const className = enabled
		? "p-2 border rounded-lg cursor-pointer select-none"
		: "p-2 border rounded-lg bg-gray-100 cursor-not-allowed select-none"

	return (
		<div
			className={className}
			onClick={(e) => {
				if (!enabled) return
				onClick()
			}}
		>
			{text}
		</div>
	)
}

function ActionsTable({ topic }: { topic: string }) {
	// store a stack of pagination cursors, so that we can go back
	const [paginationCursors, setPaginationCursors] = useState<string[]>([])

	const query: Record<string, any> = {
		type: "action",
		order: "desc",
		limit: entriesPerPage + 1,
	}
	if (paginationCursors.length > 0) {
		query["lt"] = paginationCursors[paginationCursors.length - 1]
	}
	const { data: actions, error } = useSWR(
		`/canvas_api/${topic}/messages?${Object.entries(query)
			.map((entry) => entry.join("="))
			.join("&")}`,
		fetchAndIpldParseJson<Result<Action>[]>,
		{
			refreshInterval: 1000,
		},
	)

	if (error) return <div>failed to load</div>
	if (!actions) return <div>loading...</div>

	// in order to determine if another page exists, we retrieve n + 1 entries
	// but we don't want to display the last entry, so we pop it
	const hasMore = actions.length > entriesPerPage
	const actionsToDisplay = hasMore ? actions.slice(0, -1) : actions

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-col gap-1">
				<div className="text-sm">Latest Actions</div>
				<div>Action history for this topic, sorted by timestamp</div>
			</div>
			<div className="border rounded-lg py-1">
				<table className="table-auto w-full rounded text-left rtl:text-right">
					<thead>
						<tr className="border-b">
							<th className="pl-6 pr-3 font-normal">Address</th>
							<th className="px-3 font-normal">Action</th>
							<th className="px-3 font-normal">Args</th>
							<th className="px-3 font-normal">Timestamp</th>
							<th className="pl-3 pr-6 font-normal">Session</th>
						</tr>
					</thead>
					<tbody>
						{actionsToDisplay.map(([cid, signature, message]) => {
							const args = JSON.stringify(message.payload.args)
							return (
								<tr key={cid}>
									<td className="break-all pl-6 pr-3 py-2">{message.payload.address.slice(0, 15)}...</td>
									<td className="break-all px-3">{message.payload.name}</td>
									<td className="break-all px-3">{args.length > 50 ? <ArgsPopout data={args} /> : args}</td>
									<td className="break-all px-3">{formatDistanceCustom(message.payload.timestamp)} ago</td>
									<td className="break-all pl-3 pr-6">
										{signature.publicKey.slice(0, 25)}...
										<SessionField message={message} signature={signature} />
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
			<div className="flex flex-row gap-2">
				<div className="flex-grow"></div>
				<PaginationButton
					text="Previous"
					enabled={paginationCursors.length > 0}
					onClick={() => {
						setPaginationCursors((paginationCursors) => paginationCursors.slice(0, -1))
					}}
				/>
				<PaginationButton
					text="Next"
					enabled={hasMore}
					onClick={() => {
						const newCursor = actionsToDisplay[actionsToDisplay.length - 1][0]
						setPaginationCursors((paginationCursors) => [...paginationCursors, newCursor])
					}}
				/>
			</div>
		</div>
	)
}

export default ActionsTable
