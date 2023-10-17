import { FormEvent, useState, useRef } from "react"
import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"
import { Forum } from "@canvas-js/templates"
import useHashParam from "use-hash-param"
import { Canvas } from "@canvas-js/core"

type Channel = { name: string }
type Thread = { id: string, message: string, address: string, timestamp: number, channel: string, replies: number }
type Reply = { id: string, threadId: string, reply: string, address: string, timestamp: number, }

function App() {
	let privateKey = localStorage.getItem("privatekey")
	if (privateKey === null) {
		privateKey = ethers.Wallet.createRandom().privateKey
		localStorage.setItem("privatekey", privateKey)
	}
	const wallet = new ethers.Wallet(privateKey)

	const { app } = useCanvas({
		contract: { ...Forum, topic: "channel-chat-example" },
		signers: [new SIWESigner({ signer: wallet })],
		location: "-",
	})

	const [thread, setThread] = useHashParam("thread", "")
	const [channel, setChannel] = useHashParam("channel", "all")
	const [page, setPage] = useState(0)

	const channels = useLiveQuery<Channel>(app, "channels", {}) || []
	const displayedChannels = [{ name: "all" } as Channel].concat(channels)
	const channelInputRef = useRef<HTMLInputElement>(null)

	const createChannel = (e: FormEvent) => {
		e.preventDefault()
		if (!channelInputRef.current) return

		const channel = channelInputRef.current.value
		app?.actions
			.joinChannel({ address: wallet.address, channel })
			.then(() => {
				if (!channelInputRef.current) return
				channelInputRef.current.value = ""
			})
			.catch((err) => console.log(err))
	}

	return 	<div className="w-full flex">
	<div className="fixed bg-white w-xl w-64 h-screen py-4 mr-8 border-r border-gray-200 flex flex-col">
		<div className="px-6 pb-3">
			<a
				href="#"
				className="font-semibold"
				onClick={(e) => {
					e.preventDefault()
					setThread("")
					setChannel("all")
					setPage(0)
				}}
			>
				My Forum
			</a>
		</div>
		<div className="flex-1 pt-4 border-t border-gray-200">
			{displayedChannels.map((c) => (
				<div>
					<a
						href="#"
						className={`block px-6 py-1.5 hover:bg-gray-100 ${
							channel === c.name ? "bg-gray-100 font-semibold" : ""
						}`}
						key={c.name}
						onClick={(e) => {
							e.preventDefault()
							setThread("")
							setChannel(encodeURIComponent(c.name))
							setPage(0)
						}}
					>
						{c.name === "all" ? "📚 All Posts" : c.name}
					</a>
				</div>
			))}
		</div>
		<form className="px-6" onSubmit={createChannel}>
			<input
				className="input mr-2 w-full"
				type="text"
				placeholder="Create a new channel..."
				ref={channelInputRef}
			/>
			<button className="btn btn-blue w-full mt-2" type="submit">
				Create
			</button>
		</form>
		{channel !== "all" && (
			<div className="px-6 pb-2">
				<button className="btn btn-red w-full mt-2" type="submit">
					Delete this channel
				</button>
			</div>
		)}
	</div>
		{thread 
			? <RepliesPage wallet={wallet} app={app} thread={thread} setThread={setThread}/> 
			: <ThreadsPage wallet={wallet} app={app} page={page} setPage={setPage} channel={channel} setChannel={setChannel} setThread={setThread}/>}
	</div>
}

function RepliesPage({ wallet, app, thread, setThread }: { wallet: ethers.Wallet, app?: Canvas, thread: string, setThread: Function }) {
	const [page, setPage] = useState(0)
	const replies = useLiveQuery<Reply>(app, "replies", {
		offset: page * 10,
		limit: 10,
		orderBy: { timestamp: "desc" },
		where: { threadId: thread }
	})
	return <div className="w-xl ml-64 pl-8">
		<div className="my-8">
			<Composer app={app} replyingTo={thread} setReplyingTo={setThread} />
		</div>
		{replies?.map((reply) => <div key={reply.id}>
			<div className="mb-1 text-sm text-gray-400">
				{reply.address}
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

		</div>)}
	</div>;
}

function Composer({ app, channel, replyingTo, setReplyingTo }: { app?: Canvas, channel?: string, replyingTo?: string, setReplyingTo: Function }) {
	const inputRef = useRef<HTMLTextAreaElement>(null)

	const send = (e: FormEvent) => {
		e.preventDefault()
		if (!inputRef.current) return

		if (replyingTo) {
			const reply = inputRef.current.value
			app?.actions
				.sendReply({ threadId: replyingTo, reply })
				.then(() => {
					if (!inputRef.current) return
					inputRef.current.value = ""
				})
				.catch((err) => console.log(err))
		} else if (channel) {
			const message = inputRef.current.value
			app?.actions
				.sendMessage({ message, channel })
				.then(() => {
					if (!inputRef.current) return
					inputRef.current.value = ""
				})
				.catch((err) => console.log(err))
		} else {
			throw new Error("Unexpected: must provide either replyingTo or channel")
		}
	}

	return (<form className="my-8" onSubmit={send}>
		<textarea className="input w-full" placeholder="New post" ref={inputRef}></textarea>
		<div className="flex">
			<div className="flex-1">
				<button className="btn btn-blue" type="submit">
					{replyingTo ? "Reply" : "Create Post"}
				</button>
			</div>
			{replyingTo && (
				<div className="text-gray-600 mt-1.5">
					Replying to: {replyingTo} -{" "}
					<a
						href="#"
						onClick={(e) => {
							e.preventDefault()
							setReplyingTo(undefined)
						}}
					>
						Clear
					</a>
				</div>
			)}
		</div>
	</form>)
}

function ThreadsPage({ wallet, app, page, setPage, channel, setChannel, setThread }: { wallet: ethers.Wallet, app?: Canvas, page: number, setPage: Function, channel: string, setChannel: Function, setThread: Function }) {
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

export default App
