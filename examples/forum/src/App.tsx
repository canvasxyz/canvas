import React, { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Scroll from "@radix-ui/react-scroll-area";
import * as Separator from "@radix-ui/react-separator";
import * as Avatar from "@radix-ui/react-avatar";

// Types for our app
interface User {
	id: string;
	name: string;
	avatar: string;
}

interface Message {
	id: string;
	title: string;
	text: string;
	userId: string;
	timestamp: Date;
}

export const App: React.FC<{}> = () => {	// Messages state
	const [messages, setMessages] = useState<Message[]>([
		{
			id: "msg-1",
			title: "Hello world!",
			text: "This is my first post on this forum thing.",
			userId: "user-2",
			timestamp: new Date(Date.now() - 3600000)
		},
		{
			id: "msg-2",
			title: "Second post",
			text: "Thanks for having me here!",
			userId: "user-3",
			timestamp: new Date(Date.now() - 1800000)
		},
	]);
	
	// New message state
	const [newMessage, setNewMessage] = useState<string>("");
	const [newTitle, setNewTitle] = useState<string>("");

	// Reference to message container for scrolling
	const messageEndRef = useRef<HTMLDivElement>(null);

	// Function to send a new message
	const sendMessage = (e: React.FormEvent) => {
		e.preventDefault();
		
		// Check that both title and text are provided
		if (!newTitle.trim() || !newMessage.trim()) return;
		
		const newMsg = {
			id: `msg-${Date.now()}`,
			title: newTitle,
			text: newMessage,
			userId: "user-0",
			timestamp: new Date()
		};
		
		setMessages([...messages, newMsg]);
		setNewMessage("");
		setNewTitle("");
	};

	// Scroll to bottom when messages change
	useEffect(() => {
		messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// Function to handle textarea key events for Cmd+Enter submission
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			sendMessage(e);
		}
	};
	
	// Ref for the textarea element
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	
	// Function to auto-resize textarea
	const autoResizeTextarea = () => {
		if (textareaRef.current) {
			// Reset height to auto to get the correct scrollHeight
			textareaRef.current.style.height = '0px';
			// Set the height to the scrollHeight to fit the content
			const scrollHeight = textareaRef.current.scrollHeight + 23;
			textareaRef.current.style.height = `${scrollHeight}px`;
		}
	};

	useEffect(() => {
		autoResizeTextarea();
	}, [newMessage]);

	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = '60px';
			autoResizeTextarea();
		}
	}, []);

	return (
		<div className="flex h-screen w-full bg-gray-900">
			{/* Sidebar */}
			<div className="w-64 bg-gray-900 text-white flex flex-col border-r border-gray-700">
				<div className="border-b border-gray-700 px-6 py-3">
					<h2 className="font-medium text-lg text-white">Poster</h2>
				</div>
				
				<Scroll.Root className="flex-grow overflow-auto">
					<Scroll.Viewport className="w-full h-full">
						<div className="py-4">
							{/* sidebar content here */}
						</div>
					</Scroll.Viewport>
					<Scroll.Scrollbar 
						className="flex select-none touch-none p-0.5 bg-gray-700/50 transition-colors duration-150 ease-out hover:bg-gray-700/80 w-2.5" 
						orientation="vertical"
					>
						<Scroll.Thumb className="flex-1 bg-gray-500 rounded-full relative" />
					</Scroll.Scrollbar>
				</Scroll.Root>
			</div>
			
			{/* Main chat area */}
			<div className="flex-1 flex flex-col overflow-hidden bg-gray-900 relative">				
				<div className="border-b border-gray-700 px-6 py-3">
					<h2 className="font-medium text-lg text-white">All Posts</h2>
				</div>

				{/* Add padding at the bottom to make space for the fixed composer */}
				<Scroll.Root className="flex-1 overflow-hidden pb-[90px]">
					<Scroll.Viewport className="h-full w-full">
						<div className="p-4 space-y-6">
							{messages.map(message => {
								return (
									<div key={message.id} className="flex gap-3">
										<div className="flex-1">
											<div className="flex items-baseline">
												<span className="font-bold mr-2 text-white">{"Demo user"}</span>
												<span className="text-xs text-gray-400">
													{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
												</span>
											</div>
											{message.title && <h3 className="text-white font-semibold mt-1">{message.title}</h3>}
											<p className="text-gray-300 mt-1">{message.text}</p>
										</div>
									</div>
								);
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
								setNewMessage(e.target.value);
								setTimeout(autoResizeTextarea, 0);
							}}
							onKeyDown={handleKeyDown}
							placeholder="Write a new post here..."
							className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 min-h-[40px] resize-none overflow-auto"
							style={{ maxHeight: '200px' }}
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
			</div>
		</div>
	);
};
