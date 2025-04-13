import React, { useState, useEffect, useRef } from "react"
import * as Scroll from "@radix-ui/react-scroll-area"
import { AppT } from "./index.js"
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"

export const App: React.FC<{ app: AppT }> = ({ app }) => {
	const posts = useLiveQuery(app, "posts") ?? []

	const [newMessage, setNewMessage] = useState<string>("")
	const [newTitle, setNewTitle] = useState<string>("")
	const messageEndRef = useRef<HTMLDivElement>(null)
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	const sendMessage = (e: React.FormEvent) => {
		e.preventDefault()
		if (!newTitle.trim() || !newMessage.trim()) return
		app.actions.createPost(newTitle, newMessage).then(() => {
			setNewMessage("")
			setNewTitle("")
		})
	}

	// Scroll to bottom when messages change
	useEffect(() => {
		messageEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [posts])

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault()
			sendMessage(e)
		}
	}

	const autoResizeTextarea = () => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "0px"
			const scrollHeight = textareaRef.current.scrollHeight + 23
			textareaRef.current.style.height = `${scrollHeight}px`
		}
	}

	useEffect(() => {
		autoResizeTextarea()
	}, [newMessage])

	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "60px"
			autoResizeTextarea()
		}
	}, [])

	return (
		<div className="flex h-screen w-full bg-gray-900">
			{/* Sidebar */}
			<div className="w-64 bg-gray-900 text-white flex flex-col border-r border-gray-700">
				<div className="border-b border-gray-700 px-6 py-3">
					<h2 className="font-medium text-lg text-white">Poster</h2>
				</div>

				<Scroll.Root className="flex-grow overflow-auto">
					<Scroll.Viewport className="w-full h-full">
						<div className="py-4">{/* sidebar content here */}</div>
					</Scroll.Viewport>
					<Scroll.Scrollbar
						className="flex select-none touch-none p-0.5 bg-gray-700/50 transition-colors duration-150 ease-out hover:bg-gray-700/80 w-2.5"
						orientation="vertical"
					>
						<Scroll.Thumb className="flex-1 bg-gray-500 rounded-full relative" />
					</Scroll.Scrollbar>
				</Scroll.Root>
			</div>

			{/* Main post area */}
			<div className="flex-1 flex flex-col overflow-hidden bg-gray-900 relative">
				<div className="border-b border-gray-700 px-6 py-3">
					<h2 className="font-medium text-lg text-white">All Posts</h2>
				</div>

				{/* Add padding at the bottom to make space for the fixed composer */}
				<Scroll.Root className="flex-1 overflow-hidden pb-[90px]">
					<Scroll.Viewport className="h-full w-full">
						<div className="p-4 space-y-6">
							{posts.map((post) => {
								return (
									<div key={post.id} className="flex gap-3">
										<div className="flex-1">
											<h3 className="text-white font-semibold mt-1">{post.title}</h3>
											<div className="text-xs text-gray-400">
												{post.author} -{" "}
												{new Date(post.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
											</div>
											<p className="text-gray-300 mt-1">{post.text}</p>
										</div>
									</div>
								)
							})}
							<div ref={messageEndRef} />
						</div>
					</Scroll.Viewport>
					<Scroll.Scrollbar
						className="flex select-none touch-none p-0.5 bg-gray-800 transition-colors duration-150 ease-out hover:bg-gray-700 w-2.5"
						orientation="vertical"
					>
						<Scroll.Thumb className="flex-1 bg-gray-600 rounded-full relative" />
					</Scroll.Scrollbar>
				</Scroll.Root>

				{/* Fixed composer at the bottom */}
				{app?.hasSession() && (
					<div className="fixed bottom-0 right-0 left-64 bg-gray-900 border-t border-gray-700">
						<form onSubmit={sendMessage} className="flex flex-col p-4">
							<input
								value={newTitle}
								onChange={(e) => setNewTitle(e.target.value)}
								placeholder="Post title"
								className="w-full px-4 py-2 mb-2 bg-gray-800 border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
							/>
							<textarea
								ref={textareaRef}
								value={newMessage}
								onChange={(e) => {
									setNewMessage(e.target.value)
									setTimeout(autoResizeTextarea, 0)
								}}
								onKeyDown={handleKeyDown}
								placeholder="Write a new post here..."
								className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 min-h-[40px] resize-none overflow-auto"
								style={{ maxHeight: "200px" }}
								rows={2}
							/>
							<div className="flex justify-between items-center mt-3">
								<button
									type="submit"
									className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
									disabled={!newTitle.trim() || !newMessage.trim()}
								>
									Send
								</button>
							</div>
						</form>
					</div>
				)}
			</div>
		</div>
	)
}
