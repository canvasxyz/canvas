import React from "react"

type Message = {
	content: string
	creator_id: string
	created_at: Date
}

export const Messages: React.FC<{ messages: Message[] }> = ({ messages }) => {
	return (
		<div className="flex flex-col grow m-3 gap-3">
			{messages.map((message, index) => {
				const is_sent = message.creator_id == "1"
				return (
					<div key={index}>
						<div className="flex justify-center text-gray-300">{message.created_at.toLocaleTimeString()}</div>
						<div className={`flex ${is_sent ? "flex-row" : "flex-row-reverse"}`}>
							<div
								className={
									is_sent
										? "p-3 rounded-r-lg rounded-tl-lg bg-blue-500 text-white"
										: "p-3 rounded-l-lg rounded-tr-lg bg-gray-200 text-black"
								}
							>
								{message.content}
							</div>
						</div>
					</div>
				)
			})}
		</div>
	)
}
