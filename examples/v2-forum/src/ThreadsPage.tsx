import { useState } from "react"
import { ethers } from "ethers"

import { useLiveQuery } from "@canvas-js/hooks"
import { Canvas } from "@canvas-js/core"
import { Composer } from "./Composer"

import type { Thread } from "./App"

export function ThreadsPage({
	wallet,
	app,
	page,
	setPage,
	channel,
	setChannel,
	setThread,
}: {
	wallet: ethers.Wallet
	app?: Canvas
	page: number
	setPage: Function
	channel: string
	setChannel: Function
	setThread: Function
}) {
	const [replyingTo, setReplyingTo] = useState<string>()

	const messages = useLiveQuery<Thread>(app, "threads", {
		offset: page * 10,
		limit: 10,
		orderBy: { timestamp: "desc" },
		where: channel === "all" ? undefined : { channel },
	})

	return (
		<div className="w-xl ml-64 pl-8">
			<div className="my-8">
				<Composer app={app} channel={channel} replyingTo={replyingTo} setReplyingTo={setReplyingTo} />
			</div>
			<div className="py-3 pb-4">
				{messages?.map((message) => (
					<div className="pb-6" key={message.id?.toString()}>
						<div className="mb-1 text-sm text-gray-400">
							{message.address}
							{" - "}
							<a
								href="#"
								onClick={(e) => {
									e.preventDefault()
									setChannel(undefined)
									setThread(message.id)
								}}
							>
								Open
							</a>
							{" - "}
							{message.replies} replies
							{message.address === wallet.address && (
								<>
									{" - "}
									<a
										className="hover:underline hover:text-gray-600"
										href="#"
										onClick={(e) => {
											e.preventDefault()

											if (!confirm("Really delete this post?")) return
											app?.actions.deleteMessage({ id: message.id })
										}}
									>
										Delete
									</a>
								</>
							)}
						</div>
						<div className="whitespace-pre">{message.message}</div>
					</div>
				))}
			</div>
			<div className="pb-6">
				<div className="inline-block mr-3">Page: {page + 1}</div>
				<button className="btn btn-blue mr-1.5" onClick={() => setPage(Math.max(0, page - 1))}>
					Prev
				</button>
				<button className="btn btn-blue mr-1.5" onClick={() => setPage(page + 1)}>
					Next
				</button>
			</div>
		</div>
	)
}
