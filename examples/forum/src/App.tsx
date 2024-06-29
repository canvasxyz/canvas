import { useState } from "react"
import { ethers } from "ethers"

import type { Contract } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { useCanvas } from "@canvas-js/hooks"
import { default as useHashParam } from "use-hash-param"

import { Persister } from "./Persister.js"
import { Sidebar } from "./Sidebar.js"
import { RepliesPage } from "./RepliesPage.js"
import { ThreadsPage } from "./ThreadsPage.js"

export type Tag = {
	name: string
}
export type Category = {
	name: string
}
export type Thread = {
	id: string
	title: string
	message: string
	address: string
	timestamp: number
	category: string
	replies: number
}
export type Reply = {
	id: string
	threadId: string
	reply: string
	address: string
	timestamp: number
}

const Forum = {
	models: {
		categories: {
			name: "primary",
		},
		tags: {
			name: "primary",
		},
		memberships: {
			id: "primary",
			user: "string",
			category: "string",
			timestamp: "integer",
		},
		threads: {
			id: "primary",
			title: "string",
			message: "string",
			address: "string",
			timestamp: "integer",
			category: "string",
			replies: "integer",
			$indexes: [["category"], ["address"], ["timestamp"]],
		},
		replies: {
			id: "primary",
			threadId: "@threads",
			reply: "string",
			address: "string",
			timestamp: "integer",
			$indexes: [["threadId"]],
		},
	},
	actions: {
		async createTag(db, { tag }, { address, timestamp, id }) {
			if (!tag || !tag.trim()) throw new Error()
			await db.set("tags", { name: tag })
		},
		async deleteTag(db, { tag }, { address, timestamp, id }) {
			await db.delete("tags", tag)
		},
		async createCategory(db, { category }, { address, timestamp, id }) {
			if (!category || !category.trim()) throw new Error()
			await db.set("categories", { name: category })
		},
		async deleteCategory(db, { category }, { address, timestamp, id }) {
			await db.delete("categories", category)
		},
		async createThread(db, { title, message, category }, { address, timestamp, id }) {
			if (!message || !category || !title || !message.trim() || !category.trim() || !title.trim()) throw new Error()
			await db.set("threads", { id, title, message, category, address, timestamp, replies: 0 })
		},
		async deleteMessage(db, { id }, { address, timestamp }) {
			const message = await db.get("threads", id)
			if (!message || message.address !== address) throw new Error()
			await db.delete("threads", id)
		},
		async createReply(db, { threadId, reply }, { address, timestamp, id }) {
			const thread = await db.get("threads", threadId)
			if (!thread || !threadId) throw new Error()
			await db.set("threads", { ...thread, replies: (thread.replies as number) + 1 })
			await db.set("replies", { id, threadId, reply, address, timestamp })
		},
		async deleteReply(db, { replyId }, { address, timestamp, id }) {
			const reply = await db.get("replies", replyId)
			if (!reply) throw new Error()
			const thread = await db.get("threads", reply.threadId as string)
			if (!thread) throw new Error()
			await db.set("threads", { ...thread, replies: (thread.replies as number) - 1 })
			await db.delete("replies", replyId)
		},
	},
} satisfies Contract

export function Placeholder({ text }: { text: string }) {
	return <div className="text-gray-400 mb-4">{text}</div>
}

export function Loading() {
	return <div className="text-gray-400 mb-4">Loading...</div>
}

function App() {
	let privateKey = localStorage.getItem("privatekey")
	if (privateKey === null) {
		privateKey = ethers.Wallet.createRandom().privateKey
		localStorage.setItem("privatekey", privateKey)
	}
	const wallet = new ethers.Wallet(privateKey)

	const { app } = useCanvas({
		topic: "canvas-example-forum",
		contract: Forum,
		signers: [new SIWESigner({ signer: wallet })],
	})

	const [thread, setThread] = useHashParam("thread", "")
	const [category, setCategory] = useHashParam("category", "all")
	const [tag, setTag] = useHashParam("tag", "")
	const [page, setPage] = useState(0)

	return (
		<div className="w-full flex">
			<Persister app={app} />
			<Sidebar
				category={category}
				tag={tag}
				setThread={setThread}
				setCategory={setCategory}
				setTag={setTag}
				setPage={setPage}
				app={app}
				wallet={wallet}
			/>
			{thread ? (
				<RepliesPage wallet={wallet} app={app} thread={thread} />
			) : (
				<ThreadsPage
					wallet={wallet}
					app={app}
					page={page}
					setPage={setPage}
					category={category}
					setCategory={setCategory}
					setThread={setThread}
				/>
			)}
		</div>
	)
}

export default App
