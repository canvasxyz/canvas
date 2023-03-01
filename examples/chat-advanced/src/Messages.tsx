import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo, useContext } from "react"
import { Virtuoso } from "react-virtuoso"
import _ from "lodash"
import { DateTime } from "luxon"

import { useEnsName } from "wagmi"
import { Client, useRoute } from "@canvas-js/hooks"
import { AppContext } from "./AppContext"

type Post = {
	id: string
	from_id: `0x${string}`
	content: string
	updated_at: number
	imported: boolean
}

export const MessagesInfiniteScroller: React.FC<{}> = ({}) => {
	const [posts, setPosts] = useState<Post[]>([])
	const [cursor, setCursor] = useState<string | number>("")

	// Virtuoso uses firstItemIndex to maintain scroll position when
	// items are added. It should always be set *relative to its
	// original value* and cannot be negative, so we initialize it
	// with a very large MAX_VALUE.
	const MAX_VALUE = 999999999
	const virtuoso = useRef(null)
	const [firstItemIndex, setFirstItemIndex] = useState<number>(MAX_VALUE)

	// Past posts are fetched declaratively, by updating `cursor`.
	// Because of pagination, the route returns a window of posts ordered
	// monotonically the same as displayed posts, but potentially overlapping
	// or interleaved with them, so we use a Map to filter out duplicates.
	const { data: pastPosts } = useRoute<Post>("/posts", { before: cursor }, { subscribe: false })

	// Maintain a subscription to the most recent page of posts.
	// We assume that posts are received in-order, an assumption which
	// may be violated when generating data.
	const { data: newPosts } = useRoute<Post>("/posts", { before: "" })

	useEffect(() => {
		if (!pastPosts || !newPosts) return

		if (posts.length === 0) {
			if (newPosts.length === 0) return

			const filteredNewPosts = [...newPosts]
			filteredNewPosts.reverse()
			setPosts(filteredNewPosts)
		} else {
			const postsM = new Map(posts.map((f) => [f.id, f]))
			const filteredPastPosts = pastPosts.filter((item) => !postsM.has(item.id))
			const filteredNewPosts = newPosts.filter((item) => !postsM.has(item.id))
			if (filteredPastPosts.length === 0 && filteredNewPosts.length === 0) return
			setFirstItemIndex(firstItemIndex - filteredPastPosts.length)
			filteredPastPosts.reverse()
			filteredNewPosts.reverse()

			// Interleave new posts according to updated_at, so if we
			// receive new posts out-of-order (happens frequently on batch insert)
			// they won't persist out-of-order
			let result
			if (
				// check if all posts are ordered
				(filteredPastPosts.length === 0 && posts.length === 0) ||
				(posts.length === 0 && filteredNewPosts.length === 0)
			) {
				result = [...filteredPastPosts, ...posts, ...filteredNewPosts]
			} else {
				// check if past + present posts are ordered
				if (
					filteredPastPosts.length === 0 ||
					posts.length === 0 ||
					filteredPastPosts[filteredPastPosts.length - 1].updated_at < posts[0].updated_at
				) {
					result = [...filteredPastPosts, ...posts]
				} else {
					result = _.sortedUniqBy(_.sortBy([...filteredPastPosts, ...posts], "updated_at"), "updated_at")
				}
				// check if present + new posts are ordered
				if (
					result.length === 0 ||
					filteredNewPosts.length === 0 ||
					result[result.length - 1].updated_at < filteredNewPosts[0].updated_at
				) {
					result = [...result, ...filteredNewPosts]
				} else {
					result = _.sortedUniqBy(_.sortBy([...result, ...filteredNewPosts], "updated_at"), "updated_at")
				}
			}
			setPosts(result)

			// Scroll-to-bottom doesn't seem to work correctly, Virtuoso incorrectly
			// caps the maximum scroll to `scroller.offsetHeight - scroller.scrollHeight`
			// when there might be additional not-yet-rendered content at the bottom.
			if (filteredPastPosts.length === 0) {
				const scroller = document.querySelector("[data-virtuoso-scroller=true]") as HTMLElement
				if (scroller === null) return
				// Only scroll-to-bottom if we're already near the bottom
				if (scroller.scrollTop + scroller.offsetHeight < scroller.scrollHeight - 40) return
				setTimeout(() => {
					scroller.scrollTop = 99999999
					setTimeout(() => {
						scroller.scrollTop = 99999999
					}, 10)
				}, 10)
			}
		}
	}, [newPosts, pastPosts, posts])

	const startReached = useCallback(
		(index: number) => {
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

	const itemContent = useCallback((index: number, post: Post) => <Post key={post.id} {...post} />, [])
	// const followOutput = useCallback((isAtBottom) => (isAtBottom ? "auto" : false), [])

	return (
		<ul className="tree-view">
			{posts.length > 0 && (
				<Virtuoso
					atBottomThreshold={40}
					ref={virtuoso}
					firstItemIndex={firstItemIndex}
					initialTopMostItemIndex={posts.length}
					itemContent={itemContent}
					data={posts}
					startReached={startReached}
					// followOutput={followOutput}
					style={{ flex: "1 1 auto", overscrollBehavior: "contain" }}
					increaseViewportBy={{ bottom: 40, top: 40 }}
				/>
			)}
		</ul>
	)
}

export const Messages: React.FC = ({}) => {
	const inputRef = useRef<HTMLInputElement>(null)
	const { client } = useContext(AppContext)

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

const Post: React.FC<Post> = ({ from_id, content, updated_at, imported }) => {
	const address = `${from_id.slice(0, 5)}…${from_id.slice(-4)}`
	// use wagmi's internal cache for ens names
	const { data, isError, isLoading } = useEnsName({ address: from_id })
	const [displayTime, setDisplayTime] = useState<string>()

	useEffect(() => {
		const now = DateTime.local()
		const past = DateTime.fromMillis(updated_at)
		const secs = now.diff(past, "seconds").seconds
		if (secs < 60) {
			setDisplayTime("just now")
			return
		}
		const mins = now.diff(past, "minutes").minutes
		if (mins < 60) {
			setDisplayTime(`${Math.floor(mins)}min`)
			return
		}
		const hrs = now.diff(past, "hours").hours
		if (hrs < 24) {
			setDisplayTime(`${Math.floor(hrs)}h`)
			return
		}
		const days = now.diff(past, "days").days
		if (days < 7) {
			setDisplayTime(`${Math.floor(days)}d`)
			return
		}
		setDisplayTime(past.toSQLDate())
	}, [updated_at])

	return (
		<li>
			{data && <span className="address address-ens">[{data}]</span>}
			<span className="address">{address} &gt;</span> {content}
			<span className="time-ago">
				{imported ? "[imported]" : ""} {displayTime}
			</span>
		</li>
	)
}
