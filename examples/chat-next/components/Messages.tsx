import _ from "lodash"
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Virtuoso } from "react-virtuoso"

import { useEnsName } from "wagmi"
import { Client, useRoute } from "@canvas-js/hooks"

type Post = {
	id: string
	from_id: `0x${string}`
	content: string
	updated_at: number
}

export const MessagesInfiniteScroller: React.FC<{}> = ({}) => {
	const [posts, setPosts] = useState<Post[]>([])
	const [cursor, setCursor] = useState<string>("")

	// Virtuoso uses firstItemIndex to maintain scroll position when
	// items are added. It should always be set *relative to its
	// original value* and cannot be negative, so we initialize it
	// with a very large MAX_VALUE.
	const MAX_VALUE = 999999999
	const virtuoso = useRef(null)
	const [firstItemIndex, setFirstItemIndex] = useState<number>(MAX_VALUE)

	// Posts are fetched declaratively, by updating `cursor`.
	const { data: fetched, error } = useRoute<Post>("/posts", { before: cursor })

	// Because of pagination, /posts returns a window of posts ordered
	// the same as displayed posts, but potentially overlapping or
	// interleaved, so we use a set comparision to filter out duplicates.
	//
	// New posts may enter *anywhere* in the window, but we only maintain
	// a subscription to the latest (before = "") or (before = cursor)
	useEffect(() => {
		if (!fetched) return

		if (posts.length === 0) {
			const filtered = [...fetched]
			filtered.reverse()
			setPosts(filtered)
		} else {
			const postsM = new Map(posts.map((f) => [f.id, f]))
			const filtered = fetched.filter((item) => !postsM.has(item.id))
			if (filtered.length === 0) return
			setFirstItemIndex(firstItemIndex - filtered.length)
			filtered.reverse()
			// TODO: Interleave new posts according to updated_at, so if we
			// receive new posts out-of-order (happens frequenty on first insert)
			// then they won't persist out-of-order
			setPosts([...filtered, ...posts])
		}
	}, [fetched, posts])

	const startReached = useCallback(
		(event: React.UIEvent<HTMLElement>) => {
			console.log("startReached")
			if (posts.length === 0) return

			setTimeout(() => {
				const earliestPost = posts[0]
				const newCursor = earliestPost?.updated_at?.toString()
				if (!earliestPost || cursor === earliestPost.updated_at) return // Nothing more
				setCursor(earliestPost.updated_at)
				console.log("cursor changed:", earliestPost.updated_at)
			}, 500)
		},
		[posts, cursor]
	)

	const itemContent = useCallback((index, post) => <Post key={post.id} {...post} />, [])
	const followOutput = useCallback((isAtBottom) => (isAtBottom ? "smooth" : false), [])

	return (
		<ul className="tree-view">
			{posts.length > 0 && (
				<Virtuoso
					ref={virtuoso}
					firstItemIndex={firstItemIndex}
					initialTopMostItemIndex={posts.length}
					itemContent={itemContent}
					data={posts}
					startReached={startReached}
					followOutput={followOutput}
					style={{ flex: "1 1 auto", overscrollBehavior: "contain" }}
					increaseViewportBy={{ bottom: 0, top: 40 }}
				/>
			)}
		</ul>
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
