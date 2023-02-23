import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react"

import { useEnsName } from "wagmi"
import { Client, useRoute } from "@canvas-js/hooks"

type Post = {
	id: string
	from_id: `0x${string}`
	content: string
	updated_at: number
}

export const MessagesInfiniteScroller: React.FC<{}> = ({}) => {
	const { data, error } = useRoute<Post>("/posts", {})

	const scrollContainer = useRef<HTMLDivElement>(null)
	useLayoutEffect(() => {
		if (scrollContainer.current !== null) {
			scrollContainer.current.scrollTop = scrollContainer.current.scrollHeight
		}
	}, [data])

	return (
		<div id="scroll-container" ref={scrollContainer}>
			<ul className="tree-view">
				{data &&
					data.map((_, i, posts) => {
						const post = posts[posts.length - i - 1]
						return <Post key={post.id} {...post} />
					})}
			</ul>
		</div>
	)
}

export const Messages: React.FC<{ client: Client | null }> = ({ client }) => {
	const inputRef = useRef<HTMLInputElement>(null)

	const handleKeyDown = useCallback(
		async (event: React.KeyboardEvent<HTMLInputElement>) => {
			const input = inputRef.current
			if (event.key === "Enter" && input !== null && client !== null) {
				try {
					const { hash } = await client.createPost({ content: input.value })
					console.log("created post", hash)
					input.value = ""
					setTimeout(() => input.focus(), 0)
				} catch (err) {
					console.error(err)
					if (err instanceof Error) {
						alert(err.message)
					}
				}
			}
		},
		[client]
	)

	const isReady = client !== null
	useEffect(() => {
		if (isReady) {
			inputRef.current?.focus()
		}
	}, [isReady])

	return (
		<div id="messages" className="window">
			<div className="title-bar">
				<div className="title-bar-text">Messages</div>
			</div>
			<div className="window-body">
				<MessagesInfiniteScroller />
				<input
					type="text"
					disabled={!isReady}
					ref={inputRef}
					onKeyDown={handleKeyDown}
					placeholder={isReady ? "" : "Start a session to chat"}
				/>
			</div>
		</div>
	)
}

const Post: React.FC<Post> = ({ from_id, content, updated_at }) => {
	const address = `${from_id.slice(0, 5)}…${from_id.slice(-4)}`
	// use wagmi's internal cache for ens names
	const { data, isError, isLoading } = useEnsName({ address: from_id })

	return (
		<li>
			{data && <span className="address address-ens">[{data}]</span>}
			<span className="address">{address} &gt;</span> {content}
		</li>
	)
}
