import React from "react"
import { MessageEvent } from "../models/MessageEvent"

export const MessageList: React.FC<{ messages: MessageEvent[] }> = ({ messages }) => {
	return (
		<div className="flex flex-col grow ml-3 mr-3 gap-3 overflow-y-auto">
			{messages.map((message, index) => {
				const is_sent = message.sender == "1"
				return (
					<div key={index}>
						<div className="flex justify-center text-gray-300">{message.timestamp}</div>
						<div className={`flex ${is_sent ? "flex-row" : "flex-row-reverse"}`}>
							<div
								className={
									is_sent
										? "p-3 rounded-r-lg rounded-tl-lg bg-blue-500 text-white"
										: "p-3 rounded-l-lg rounded-tr-lg bg-gray-200 text-black"
								}
							>
								{message.message}
							</div>
						</div>
					</div>
				)
			})}
		</div>
	)
}
