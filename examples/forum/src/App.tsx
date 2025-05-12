import React, { useState, useEffect, useRef } from "react"
import * as Scroll from "@radix-ui/react-scroll-area"
import { ADMIN_DID, AppT } from "./index.js"
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"

const getAddressFromDid = (did: string) => {
	const matches = did.match(/[a-zA-Z0-9]+$/)
	return matches ? matches[0] : did
}

export const App: React.FC<{ app: AppT }> = ({ app }) => {
	const posts = useLiveQuery(app, "posts") ?? []

	const [newMessage, setNewMessage] = useState<string>("")
	const [newTitle, setNewTitle] = useState<string>("")
	const [sidebarOpen, setSidebarOpen] = useState<boolean>(false)
	const [composerMinimized, setComposerMinimized] = useState<boolean>(true)
	const messageEndRef = useRef<HTMLDivElement>(null)
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	const toggleSidebar = () => {
		setSidebarOpen(!sidebarOpen)
	}

	const toggleComposer = () => {
		setComposerMinimized(!composerMinimized)
	}

	// Close sidebar on click outside on mobile
	const handleContentClick = () => {
		if (window.innerWidth < 768 && sidebarOpen) {
			setSidebarOpen(false)
		}
	}

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
		if (window.self === window.top) {
			messageEndRef.current?.scrollIntoView({ behavior: "smooth" })
		}
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
			const scrollHeight = textareaRef.current.scrollHeight + 26
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

	// Check window size to automatically hide sidebar on mobile
	useEffect(() => {
		const checkWindowSize = () => {
			setSidebarOpen(window.innerWidth >= 768)
		}

		// Set initial state
		checkWindowSize()

		// Add event listener
		window.addEventListener("resize", checkWindowSize)

		// Cleanup
		return () => window.removeEventListener("resize", checkWindowSize)
	}, [])

	// Update the bottom padding to account for the full 20rem height when composer is open
	const scrollPadding = composerMinimized
		? "pb-[40px]"
		: app?.hasSession()
			? "pb-[14rem]" // Use 20rem (320px) padding when logged in and composer is open
			: "pb-[90px]" // Use the original 90px padding as fallback

	return (
		<div className="flex h-screen w-full bg-gray-900 relative">
			{/* Sidebar - hidden by default on mobile */}
			<div
				className={`${
					sidebarOpen ? "translate-x-0" : "-translate-x-full"
				} md:translate-x-0 transform transition-transform duration-300 ease-in-out fixed md:static z-30 h-full w-64 bg-gray-900 text-white flex flex-col border-r border-gray-800`}
			>
				<div className="border-b border-gray-800 px-6 py-3 flex justify-between items-center">
					{/* TODO: Title goes here. */}
					<h2 className="font-medium text-lg text-white">{document.location.hostname}</h2>
					{/* Close button for mobile sidebar */}
					<button className="text-white md:hidden focus:outline-none" onClick={toggleSidebar}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
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

			{/* Overlay to close sidebar when clicking outside on mobile */}
			{sidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" onClick={toggleSidebar} />}

			{/* Main post area */}
			<div className="flex-1 flex flex-col overflow-hidden bg-gray-900 relative" onClick={handleContentClick}>
				<div className="border-b border-gray-800 px-6 py-3 flex items-center">
					{/* Menu button for mobile */}
					<button
						className="mr-4 text-white md:hidden focus:outline-none"
						onClick={(e) => {
							e.stopPropagation()
							toggleSidebar()
						}}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					</button>
					<h2 className="font-medium text-lg text-white">All Posts</h2>
				</div>

				{/* Add padding at the bottom to make space for the fixed composer */}
				<Scroll.Root className={`flex-1 overflow-hidden ${scrollPadding}`}>
					<Scroll.Viewport className="h-full w-full">
						<div className="p-4 space-y-6">
							{posts.map((post) => {
								return (
									<div key={post.id} className="gap-3">
										<div className="px-3 max-w-[100vw]">
											<h3 className="text-lg text-white font-semibold mt-1 mb-1">{post.title}</h3>
											<div className="text-xs text-gray-500 mb-3">
												{getAddressFromDid(post.author)} -{" "}
												{new Date(post.timestamp).toLocaleString([], {
													month: "short",
													day: "numeric",
													year: "numeric",
													hour: "2-digit",
													minute: "2-digit",
													timeZoneName: "short",
												})}
												{app.hasSession(ADMIN_DID) ? (
													<span>
														{" - "}
														<a
															href="#"
															onClick={(e) => {
																e.stopPropagation()
																if (!confirm("Really delete this post?")) return
																app.actions.deletePost(post.id)
															}}
														>
															Delete
														</a>
													</span>
												) : null}
											</div>
											<div className="text-gray-300 mt-1">
												<ReactMarkdown rehypePlugins={[remarkGfm, rehypeSanitize]}>
													{post.text.replace(/\n/g, "\n\n")}
												</ReactMarkdown>
											</div>
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

				{/* Fixed composer at the bottom - updated to be responsive and minimizable */}
				{app?.hasSession() && (
					<div className="fixed bottom-0 right-0 left-0 md:left-64 bg-gray-900 border-t border-gray-800 transition-all duration-300 ease-in-out">
						{/* Make the header area clickable to expand when minimized, but not to minimize */}
						<div
							className="flex justify-between items-center px-4 mt-3"
							onClick={() => {
								if (composerMinimized) {
									setComposerMinimized(false)
								}
							}}
							style={{ cursor: composerMinimized ? "pointer" : "default" }}
						>
							<div className="text-sm text-gray-500 mt-0.5">Post Composer</div>
							<button
								onClick={(e) => {
									e.stopPropagation() // Prevent the parent's onClick from firing
									toggleComposer()
								}}
								className="text-gray-500 focus:outline-none"
								style={{ position: "relative", top: "2px" }}
							>
								{!composerMinimized ? (
									<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
										<path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
									</svg>
								) : (
									<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
										<path
											fillRule="evenodd"
											d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
											clipRule="evenodd"
										/>
									</svg>
								)}
							</button>
						</div>

						<form
							onSubmit={sendMessage}
							className={`flex flex-col px-4 pb-4 ${composerMinimized ? "h-0 overflow-hidden opacity-0" : "pt-3 opacity-100"} transition-all duration-300 ease-in-out`}
						>
							<input
								value={newTitle}
								onChange={(e) => setNewTitle(e.target.value)}
								placeholder="Title"
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
							<div className="flex justify-between items-center mt-4">
								<button
									type="submit"
									className="px-4 py-1.5 bg-blue-600 text-sm text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
