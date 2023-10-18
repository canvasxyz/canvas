import { ethers } from "ethers"
import moment from "moment"

import { useLiveQuery } from "@canvas-js/hooks"
import { Canvas } from "@canvas-js/core"
import { Composer } from "./Composer"

import { Thread, Placeholder, Loading } from "./App"
import { Address } from "./Address"

export function ThreadsPage({
	wallet,
	app,
	page,
	setPage,
	category,
	setCategory,
	setThread,
}: {
	wallet: ethers.Wallet
	app?: Canvas
	page: number
	setPage: (arg0: number) => void
	category: string
	setCategory: (arg0: string) => void
	setThread: (arg0: string) => void
}) {
	const threads = useLiveQuery<Thread>(app, "threads", {
		offset: page * 10,
		limit: 10,
		orderBy: { timestamp: "desc" },
		where: category === "all" ? undefined : { category },
	})

	return (
		<div className="w-xl ml-64 pl-8">
			<div className="my-8">
				<Composer app={app} category={category} replyingTo={undefined} />
			</div>
			<div className="py-3 pb-4">
				{threads === null && <Loading />}
				{threads?.length === 0 && <Placeholder text="No threads found" />}
				{threads?.map((message) => (
					<div className="pb-6" key={message.id?.toString()}>
						<div className="mb-1 text-sm text-gray-400">
							<Address address={message.address} />
							{" - "}
							<a
								href="#"
								className="hover:underline"
								onClick={(e) => {
									e.preventDefault()
									setCategory("")
									setThread(message.id)
								}}
							>
								{moment(message.timestamp).fromNow()}
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
						<div className="whitespace-pre font-bold">
							<a
								href="#"
								className="hover:underline"
								onClick={(e) => {
									e.preventDefault()
									setCategory("")
									setThread(message.id)
								}}
							>
								{message.title}
							</a>
						</div>
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
