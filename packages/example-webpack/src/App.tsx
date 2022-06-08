import React, { useState, useCallback, useRef } from "react"

import { useRoute, useCanvas } from "@canvas-js/hooks"

type Post = { id: string; fromId: string; content: string; timestamp: number; likes: number }

export const App: React.FC<{}> = ({}) => {
	const { error: canvasError, multihash, dispatch, connect, address } = useCanvas()
	const [posting, setPosting] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	const scrollableRef = useRef<HTMLFieldSetElement>(null)

	const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.code === "Enter") {
				const { value } = event.currentTarget
				event.currentTarget.value = ""
				setPosting(true)
				dispatch("createPost", [value])
					.then(() => console.log("successfully created post"))
					.catch((err) => console.error(err))
					.finally(() => {
						setPosting(false)
						inputRef.current?.focus()
						if (scrollableRef.current) scrollableRef.current.scrollTop = scrollableRef.current?.scrollHeight
					})
			}
		},
		[posting, dispatch]
	)

	const { error: routeError, data: posts } = useRoute<Post>("/posts")

	return (
		<>
			<header>
				<h1>Canvas Example App</h1>
			</header>
			<main>
				<fieldset>
					<legend>App</legend>
					{canvasError !== null ? (
						<div>
							<code>{canvasError.toString()}</code>
						</div>
					) : multihash !== null ? (
						<div>
							Connected to <code>{multihash}</code>
						</div>
					) : (
						<div>loading...</div>
					)}
				</fieldset>

				<fieldset>
					<legend>Account</legend>
					{address ? (
						<div>
							Logged in as <code>{address}</code>
						</div>
					) : (
						<button onClick={connect}>Connect</button>
					)}
				</fieldset>

				<fieldset ref={scrollableRef} style={{ maxHeight: "55vh", overflow: "scroll" }}>
					<legend>Messages</legend>
					{routeError ? (
						<div>
							<code>{routeError.toString()}</code>
						</div>
					) : posts ? (
						<table>
							<tbody>
								{posts.map((_, i) => {
									const post = posts[posts.length - i - 1]
									const date = new Date(post.timestamp * 1000)
									return (
										<tr key={post.id}>
											<td className="time">{date.toLocaleTimeString()}</td>
											<td className="from">
												<code>{post.fromId}</code>
											</td>
											<td className="content">{post.content}</td>
										</tr>
									)
								})}
							</tbody>
							<tfoot style={{ position: "sticky", bottom: 0, background: "white" }}>
								{address && (
									<>
										<tr>
											<td colSpan={3}>
												<hr />
											</td>
										</tr>
										<tr>
											<td></td>
											<td>
												<code>{address}</code>
											</td>
											<td>
												<input type="text" readOnly={posting} onKeyDown={handleKeyDown} ref={inputRef} />
											</td>
										</tr>
									</>
								)}
							</tfoot>
						</table>
					) : (
						<code>Loading...</code>
					)}
				</fieldset>
			</main>
		</>
	)
}

const Address: React.FC<{ address: string }> = (props) => {
	const prefix = props.address.slice(0, 5)
	const suffix = props.address.slice(-4)
	return (
		<code>
			{prefix}…{suffix}
		</code>
	)
}
