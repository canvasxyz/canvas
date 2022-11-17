import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react"

import { useEnsName } from "wagmi"
import { useCanvas, useRoute } from "@canvas-js/hooks"

type Post = {
	id: string
	from_id: string
	content: string
	updated_at: number
}

export const Messages: React.FC<{}> = ({}) => {
	const inputRef = useRef<HTMLInputElement>(null)

	const { isReady, dispatch } = useCanvas()

	const handleKeyDown = useCallback(
		async (event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter" && inputRef.current !== null) {
				const input = inputRef.current
				try {
					const { hash } = await dispatch("createPost", input.value)
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
		[isReady, dispatch]
	)
	useEffect(() => {
		if (isReady) inputRef.current?.focus()
	}, [isReady])

	const { data, error } = useRoute<Post>("/posts", {})

	const scrollContainer = useRef<HTMLDivElement>(null)
	useLayoutEffect(() => {
		if (scrollContainer.current !== null) {
			scrollContainer.current.scrollTop = scrollContainer.current.scrollHeight
		}
	}, [data])

	return (
		<div id="messages" className="window">
			<div className="title-bar">
				<div className="title-bar-text">Messages</div>
			</div>
			<div className="window-body">
				<div id="scroll-container" ref={scrollContainer}>
					<ul className="tree-view">
						{data &&
							data.map((_, i, posts) => {
								const post = posts[posts.length - i - 1]
								return <Post key={post.id} {...post} />
							})}
					</ul>
				</div>
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
