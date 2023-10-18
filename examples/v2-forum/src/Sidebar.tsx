import { useRef, FormEvent } from "react"
import { Canvas } from "@canvas-js/core"
import { useLiveQuery } from "@canvas-js/hooks"
import { Channel, Tag } from "./App"
import { ethers } from "ethers"

export function Sidebar({
	thread, channel, tag, page, setThread, setChannel, setTag, setPage, app, wallet
}: {
	thread: string, channel: string, tag: string, page: number, setThread: Function, setChannel: Function, setTag: Function, setPage: Function,
	app?: Canvas, wallet: ethers.Wallet
}) {
	const tags = useLiveQuery<Tag>(app, "tags", {}) || []
	const channels = useLiveQuery<Channel>(app, "channels", {}) || []
	const displayedChannels = [{ name: "all" } as Channel].concat(channels)
	const channelInputRef = useRef<HTMLInputElement>(null)
	const tagInputRef = useRef<HTMLInputElement>(null)

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

	const createTag = (e: FormEvent) => {
		e.preventDefault()
		if (!tagInputRef.current) return

		const tag = tagInputRef.current.value
		app?.actions
			.createTag({ address: wallet.address, tag })
			.then(() => {
				if (!tagInputRef.current) return
				tagInputRef.current.value = ""
			})
			.catch((err) => console.log(err))
	}
	
	return (
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
								channel === c.name && !tag ? "bg-gray-100 font-semibold" : ""
							}`}
							key={c.name}
							onClick={(e) => {
								e.preventDefault()
								setThread("")
								setChannel(encodeURIComponent(c.name))
								setTag("")
								setPage(0)
							}}
						>
							{c.name === "all" ? "📚 All Posts" : c.name}
						</a>
					</div>
				))}
			</div>
			<div className="flex-1 pt-4 border-t border-gray-200">
				{tags.map((t) => (
					<div>
						<a
							href="#"
							className={`block px-6 py-1.5 hover:bg-gray-100 ${tag === t?.name ? "bg-gray-100 font-semibold" : ""}`}
							key={t.name}
							onClick={(e) => {
								e.preventDefault()
								setThread("")
								setChannel("")
								setTag(t.name)
								setPage(0)
							}}
						>
							{t.name}
						</a>
					</div>
				))}
			</div>
			<form className="px-6 py-3" onSubmit={createChannel}>
				<input className="input mr-2 w-full" type="text" placeholder="Create a new channel..." ref={channelInputRef} />
				<button className="btn btn-blue w-full mt-2" type="submit">
					Create channel
				</button>
			</form>
			<form className="px-6 pb-3" onSubmit={createTag}>
				<input className="input mr-2 w-full" type="text" placeholder="Create a new tag..." ref={tagInputRef} />
				<button className="btn btn-blue w-full mt-2" type="submit">
					Create tag
				</button>
			</form>
			{channel !== "all" && (
				<div className="px-6 py-3">
					<button
						className="btn btn-red w-full mb-2"
						type="submit"
						onClick={(e) => {
							e.preventDefault()
							app?.actions.deleteChannel({ channel })
						}}
					>
						Delete this channel
					</button>
				</div>
			)}
			{tag !== "" && (
				<div className="px-6 py-3">
					<button
						className="btn btn-red w-full mb-2"
						type="submit"
						onClick={(e) => {
							app?.actions.deleteTag({ tag })
						}}
					>
						Delete this tag
					</button>
				</div>
			)}
		</div>
	)
}
