import "./App.css"

import { FormEvent, useState, useRef } from "react"
import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"
import type { Contract } from "@canvas-js/core"

type Channel = { name: string }

const ChannelChat = {
	models: {
		channels: {
			name: "primary",
		},
		memberships: {
			id: "primary",
			user: "string",
			channel: "string",
			timestamp: "integer",
		},
		messages: {
			id: "primary",
			message: "string",
			address: "string",
			timestamp: "integer",
			channel: "string",
			$indexes: [["channel"], ["address"]],
		},
	},
	actions: {
		async leaveChannel(db, { channel }, { address }) {
			await db.delete("memberships", address + channel)
		},
		async joinChannel(db, { channel }, { address }) {
			if (!channel || !channel.trim()) {
				throw new Error()
			}

			await db.set("channels", { name: channel })
			await db.set("memberships", { id: `${address}/${channel}`, user: address, channel })
		},
		async sendMessage(db, { message, channel }, { address, timestamp, id }) {
			if (!message || !channel || !message.trim() || !channel.trim()) {
				throw new Error()
			}

			await db.set("messages", { id, message, address, channel, timestamp })
		},
		async deleteMessage(db, { id }, { address }) {
			const message = await db.get("messages", id)
			if (!message || message.address !== address) throw new Error()
			await db.delete("messages", id)
		},
	},
} satisfies Contract

function App() {
	const wallet = ethers.Wallet.createRandom()
	const { app } = useCanvas({
		topic: "canvas-example-chat-channel",
		contract: ChannelChat,
		signers: [new SIWESigner({ signer: wallet })],
	})

	const [page, setPage] = useState(0)
	const [channel, setChannel] = useState<string>("home")

	const inputRef = useRef<HTMLInputElement>(null)
	const channelInputRef = useRef<HTMLInputElement>(null)

	const messages = useLiveQuery(app, "messages", {
		offset: page * 10,
		limit: 10,
		orderBy: { timestamp: "desc" },
		where: { channel },
	})
	const channels = useLiveQuery(app, "channels", {}) || []
	const displayedChannels = [{ name: "home" } as Channel].concat(
		channels.filter((channel) => channel.name !== "home") as Channel[],
	)

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
		<div style={{ display: "flex" }}>
			<div>
				<div>Channels:</div>
				{displayedChannels.map((c) => (
					<div>
						<button
							key={c.name}
							onClick={() => {
								setChannel(c.name)
								setPage(0)
							}}
						>
							{channel === c.name && "> "}
							{c.name}
						</button>
					</div>
				))}
				<form onSubmit={createChannel}>
					<input type="text" placeholder="New channel" ref={channelInputRef} />
					<button type="submit">Create</button>
				</form>
			</div>
			<div>
				<form onSubmit={send}>
					<input type="text" placeholder="New message" ref={inputRef} />
					<button type="submit">Send</button>
				</form>
				<div>
					{messages?.map((message) => (
						<div key={message.id?.toString()}>
							{message.address}: {message.message}
						</div>
					))}
				</div>
				<div>Page: {page + 1}</div>
				<button onClick={() => setPage(Math.max(0, page - 1))}>Prev</button>
				<button onClick={() => setPage(page + 1)}>Next</button>
			</div>
		</div>
	)
}

export default App
