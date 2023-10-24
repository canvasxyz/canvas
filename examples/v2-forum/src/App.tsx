import { useState } from "react"
import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { useCanvas } from "@canvas-js/hooks"
import { Forum } from "@canvas-js/templates"
import useHashParam from "use-hash-param"

import { Persister } from "./Persister"
import { Sidebar } from "./Sidebar"
import { RepliesPage } from "./RepliesPage"
import { ThreadsPage } from "./ThreadsPage"

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
		contract: Forum,
		signers: [new SIWESigner({ signer: wallet })],
		location: "-",
		topic: "forum-example",
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
