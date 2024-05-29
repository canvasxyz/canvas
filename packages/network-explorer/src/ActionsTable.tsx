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

	return <span className="text-gray-400">{session && formatDistanceCustom(session.timestamp)} ago</span>
}

const entriesPerPage = 10

function PaginationButton({ text, onClick, enabled }: { text: string; enabled: boolean; onClick: () => void }) {
	const className = enabled
		? "p-2 border rounded-lg cursor-pointer"
		: "p-2 border rounded-lg bg-gray-100 cursor-not-allowed"

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
	const [paginationCursor, setPaginationCursor] = useState<string | null>(null)
	const query: Record<string, any> = {
		type: "action",
		order: "desc",
		limit: entriesPerPage + 1,
	}
	if (paginationCursor) {
		query["lt"] = paginationCursor
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
							<th className="px-6 font-normal">Address</th>
							<th className="px-6 font-normal">Action</th>
							<th className="px-6 font-normal">Args</th>
							<th className="px-6 font-normal">Timestamp</th>
							<th className="px-6 font-normal">Session</th>
						</tr>
					</thead>
					<tbody>
						{actionsToDisplay.map(([cid, signature, message]) => (
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
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="flex flex-row gap-2">
				<PaginationButton text="Previous" enabled={true} onClick={() => {}} />
				<PaginationButton
					text="Next"
					enabled={hasMore}
					onClick={() => {
						const newCursor = actionsToDisplay[actionsToDisplay.length - 1][0]
						setPaginationCursor(newCursor)
					}}
				/>
			</div>
		</div>
	)
}

export default ActionsTable
