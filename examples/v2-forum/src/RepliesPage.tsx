import { useState } from "react"
import { ethers } from "ethers"
import moment from "moment"

import { useLiveQuery } from "@canvas-js/hooks"
import { Canvas } from "@canvas-js/core"

import type { Thread, Reply } from "./App"
import { Composer } from "./Composer"
import { Address } from "./Address"

export function RepliesPage({
	wallet,
	app,
	thread: threadId,
	setThread,
}: {
	wallet: ethers.Wallet
	app?: Canvas
	thread: string
	setThread: Function
}) {
	const [page, setPage] = useState(0)

	const thread = useLiveQuery<Thread>(app, "threads", {
		where: { id: threadId },
	})

	const replies = useLiveQuery<Reply>(app, "replies", {
		offset: page * 10,
		limit: 10,
		orderBy: { timestamp: "desc" },
		where: { threadId: threadId },
	})

	return (
		<div className="w-xl ml-64 pl-8">
			<div className="my-8">
				{thread && (
					<div className="mb-8">
						<div className="text-gray-500 text-sm">{thread[0]?.address}</div>
						<div className="text-gray-500 text-sm">
							{thread[0]?.timestamp && moment(thread[0]?.timestamp).fromNow()}
						</div>
						<div className="mt-2">{thread[0]?.message}</div>
					</div>
				)}
				{replies?.map((reply) => (
					<div className="mb-4" key={reply.id}>
						<div className="mb-1 text-sm text-gray-400">
							<Address address={reply.address} />
							{" - "}
							{reply.timestamp}
							{reply.address === wallet.address && (
								<>
									{" - "}
									<a
										className="hover:underline hover:text-gray-600"
										href="#"
										onClick={(e) => {
											e.preventDefault()

											if (!confirm("Really delete this post?")) return
											app?.actions.deleteReply({ replyId: reply.id })
										}}
									>
										Delete
									</a>
								</>
							)}
						</div>
						<div className="whitespace-pre">{reply.reply}</div>
					</div>
				))}
				<Composer app={app} replyingTo={threadId} setReplyingTo={setThread} />
			</div>
		</div>
	)
}
