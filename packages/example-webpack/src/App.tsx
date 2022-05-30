import React, { useState, useCallback } from "react"

import { useRoute, useCanvas } from "@canvas-js/hooks"

type Post = { id: string; fromId: string; content: string; timestamp: number; likes: number }

export const App: React.FC<{}> = ({}) => {
	const { multihash, currentAddress, dispatch, connect } = useCanvas()

	const [value, setValue] = useState("")

	const [posting, setPosting] = useState(false)

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>) => {
			if (!posting) {
				setValue(event.target.value)
			}
		},
		[posting]
	)

	const handlePost = useCallback(() => {
		setPosting(true)
		dispatch("createPost", [value])
			.then(() => {
				console.log("successfully created post")
				setValue("")
			})
			.catch((err) => {
				console.error("Error creating post")
				console.error(err)
			})
			.finally(() => {
				setPosting(false)
			})
	}, [value])

	const [error, posts] = useRoute<Post>("/posts")

	return (
		<main>
			<h1>Canvas Example App</h1>
			<section>
				{multihash === null ? (
					<span>loading...</span>
				) : (
					<span>
						The multihash of the app is <code>{multihash}</code>
					</span>
				)}
			</section>
			<section>
				{currentAddress ? (
					<span>
						Logged in as <code>{currentAddress}</code>
					</span>
				) : (
					<button onClick={connect}>Connect</button>
				)}
			</section>
			<section>
				<textarea disabled={posting} value={value} onChange={handleChange}></textarea>
				<br />
				<button disabled={posting} onClick={handlePost}>
					{posting ? "Posting..." : "Post"}
				</button>
			</section>
			<section>
				{error ? (
					<code>{error.toString()}</code>
				) : posts ? (
					<table>
						<tbody>
							{posts.map((post) => (
								<tr key={post.id}>
									<td>{new Date(post.timestamp).toLocaleTimeString()}</td>
									<td>
										<code>{post.fromId}</code>
									</td>
									<td>{post.content}</td>
								</tr>
							))}
						</tbody>
					</table>
				) : (
					<code>Loading...</code>
				)}
			</section>
		</main>
	)
}
