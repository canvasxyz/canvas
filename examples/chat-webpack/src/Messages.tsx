import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo } from "react"
import _ from "lodash"

import { useEnsName } from "wagmi"
import { useCanvas, useRoute } from "@canvas-js/hooks"

type Post = {
	id: string
	from_id: `0x${string}`
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
					const { hash } = await dispatch("createPost", { content: input.value })
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
		if (isReady) {
			inputRef.current?.focus()
		}
	}, [isReady])

	const [cursor, setCursor] = useState("")
	const [pages, setPages] = useState<Record<string, Post[]>>({})
	const [messages, setMessages] = useState<Post[]>([])
	const [latest, setLatest] = useState<Post[]>([]) // only used to trigger the LayoutEffect to scroll to bottom
	const [trailing, setTrailing] = useState<Post[]>([]) // messages no longer in latest, but not in scrollback

	// Subscribe to both the latest posts, and scrollback
	const callbackLatest = useCallback(
		(data: Post[] | null, error: Error | null) => {
			if (!data) return
			const hashes = new Set(data.map((d) => d.id))
			setLatest(data)
			setTrailing(latest.filter((d) => !hashes.has(d.id)).concat(trailing))
		},
		[trailing, setTrailing]
	)
	const callbackPrev = useCallback(
		(data: Post[] | null, error: Error | null) => {
			if (!data || cursor === "") return
			setPages({ ...pages, [cursor]: data })
		},
		[cursor]
	)

	const { data: curr, error } = useRoute<Post>("/posts", { before: "" }, undefined, callbackLatest)
	const { data: prev } = useRoute<Post>("/posts", { before: cursor }, undefined, callbackPrev)
	useEffect(() => {
		const scrollback = Object.keys(pages).reduce((acc: Post[], page) => acc.concat(pages[page]), [])
		setMessages(latest.concat(trailing).concat(scrollback))
	}, [latest, pages])

	// Load more on scroll
	const handleScroll = useMemo(
		() =>
			_.throttle((event: React.UIEvent<HTMLElement>) => {
				if ((event?.target as HTMLElement)?.scrollTop > 50) return
				if (messages.length > 0)
					setTimeout(() => {
						const earliestPost = messages[messages.length - 1]?.updated_at?.toString()
						if (cursor === earliestPost) return // Nothing more to load
						setCursor(earliestPost)
					})
			}, 750),
		[messages, cursor]
	)

	// Jump to bottom on load, and when the current page updates, but not when messages updates
	const scrollContainer = useRef<HTMLDivElement>(null)
	useLayoutEffect(() => {
		if (!curr?.length || !messages?.length) return
		setTimeout(() => {
			if (scrollContainer.current !== null) {
				scrollContainer.current.scrollTop = scrollContainer.current.scrollHeight
			}
		})
	}, [latest, curr?.length !== 0 && prev?.length !== 0 && messages.length !== 0])

	return (
		<div id="messages" className="window">
			<div className="title-bar">
				<div className="title-bar-text">Messages</div>
			</div>
			{error ? (
				<div className="window-body">
					<ul className="tree-view">
						<li>{error.toString()}</li>
					</ul>
				</div>
			) : (
				<div className="window-body">
					<div id="scroll-container" ref={scrollContainer} onScroll={handleScroll}>
						<ul className="tree-view">
							<Posts posts={messages} />
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
			)}
		</div>
	)
}

const Posts: React.FC<{ posts: null | Post[] }> = (props) => {
	if (props.posts === null) {
		return null
	} else {
		return (
			<>
				{props.posts.map((_, i, posts) => {
					const post = posts[posts.length - i - 1]
					return <Post key={post.id} {...post} />
				})}
			</>
		)
	}
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
