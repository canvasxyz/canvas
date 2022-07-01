import React, { useState, useCallback, useRef, useLayoutEffect } from "react"

import { useRoute, useCanvas } from "@canvas-js/hooks"

type Post = { id: string; from_id: string; content: string; updated_at: number; likes: number }

export const App: React.FC<{}> = ({}) => {
	const { error: canvasError, multihash, dispatch, connect, disconnect, address, session } = useCanvas()
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
					})
			}
		},
		[posting, dispatch]
	)

	const { error: routeError, data: posts } = useRoute<Post>("/posts")
	useLayoutEffect(() => {
		if (scrollableRef.current) scrollableRef.current.scrollTop = scrollableRef.current?.scrollHeight
	}, [posts])

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
							Logged in as <code>{address}</code>, with{" "}
							{session ? (
								<>
									session <code>{session.address}</code>
								</>
							) : (
								<>no session</>
							)}
							<button onClick={disconnect}>Logout</button>
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
									const time = new Date(post.updated_at).toLocaleTimeString()
									return (
										<tr key={post.id}>
											<td className="time">{time}</td>
											<td className="from">
												<code>{post.from_id}</code>
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
												<input
													type="text"
													readOnly={posting}
													onKeyDown={handleKeyDown}
													ref={inputRef}
													autoFocus={true}
												/>
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
