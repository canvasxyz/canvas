import { useState } from "react"
import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { useCanvas } from "@canvas-js/hooks"
import { Forum } from "@canvas-js/templates"
import useHashParam from "use-hash-param"

import { Sidebar } from "./Sidebar"
import { RepliesPage } from "./RepliesPage"
import { ThreadsPage } from "./ThreadsPage"

export type Tag = { name: string }
export type Channel = { name: string }
export type Thread = {
	id: string
	message: string
	address: string
	timestamp: number
	channel: string
	replies: number
}
export type Reply = { id: string; threadId: string; reply: string; address: string; timestamp: number }

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
	const [tag, setTag] = useHashParam("tag", "")
	const [page, setPage] = useState(0)



	return (
		<div className="w-full flex">
			<Sidebar channel={channel} tag={tag} setThread={setThread} setChannel={setChannel} setTag={setTag} setPage={setPage} app={app} wallet={wallet} />
			{thread ? (
				<RepliesPage wallet={wallet} app={app} thread={thread} setThread={setThread} />
			) : (
				<ThreadsPage
					wallet={wallet}
					app={app}
					page={page}
					setPage={setPage}
					channel={channel}
					setChannel={setChannel}
					setThread={setThread}
				/>
			)}
		</div>
	)
}

export default App
