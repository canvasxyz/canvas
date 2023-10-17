import { FormEvent, useState, useRef } from "react"
import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"
import { ChannelChat } from "@canvas-js/templates"

type Channel = { name: string }

function App() {
	let privateKey = localStorage.getItem("privatekey")
	if (privateKey === null) {
		privateKey = ethers.Wallet.createRandom().privateKey
		localStorage.setItem("privatekey", privateKey)
	}
	const wallet = new ethers.Wallet(privateKey)

	const { app } = useCanvas({
		contract: { ...ChannelChat, topic: "channel-chat-example" },
		signers: [new SIWESigner({ signer: wallet })],
		location: "-",
	})

	const [page, setPage] = useState(0)
	const [channel, setChannel] = useState<string>("all")

	const inputRef = useRef<HTMLInputElement>(null)
	const channelInputRef = useRef<HTMLInputElement>(null)

	const messages = useLiveQuery(app, "messages", {
		offset: page * 10,
		limit: 10,
		orderBy: { timestamp: "desc" },
		where: channel === "all" ? undefined : { channel },
	})
	const channels = useLiveQuery(app, "channels", {}) || []
	const displayedChannels = [{ name: "all" } as Channel].concat(channels)

	const send = (e: FormEvent) => {
		e.preventDefault()
		if (!inputRef.current) return

		const message = inputRef.current.value
		app?.actions
			.sendMessage({ message, channel })
			.then(() => {
				if (!inputRef.current) return
				inputRef.current.value = ""
			})
			.catch((err) => console.log(err))
	}

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

	return (
		<div className="w-full flex">
			<div className="fixed bg-white w-xl w-64 h-screen py-4 mr-8 border-r border-gray-200 flex flex-col">
				<div className="px-6 pb-3">
					<a
						href="#"
						className="font-semibold"
						onClick={() => {
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
								onClick={() => {
									setChannel(c.name)
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
			<div className="w-xl ml-64 pl-8">
				<form className="my-8" onSubmit={send}>
					<textarea className="input w-full" type="text" placeholder="New post" ref={inputRef}></textarea>
					<button className="btn btn-blue" type="submit">
						Create Post
					</button>
				</form>
				<div className="py-3 pb-4">
					{messages?.map((message) => (
						<div className="pb-6" key={message.id?.toString()}>
							<div className="mb-1 text-sm text-gray-400">
								{message.address}
								{message.address === wallet.address && (
									<>
										{" - "}
										<a
											className="hover:underline hover:text-gray-600"
											href="#"
											onClick={() => {
												if (!confirm("Really delete this post?")) return
												app?.actions.deleteMessage({ id: message.id })
											}}
										>
											Delete
										</a>
									</>
								)}
							</div>
							<div className="">{message.message}</div>
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
		</div>
	)
}

export default App
