import React, { useCallback, useContext, useState } from "react"

import { AppContext } from "./AppContext.js"

export interface MessageComposerProps {}

export const MessageComposer: React.FC<MessageComposerProps> = ({}) => {
	const { app } = useContext(AppContext)

	const [value, setValue] = useState("")

	const handleKeyDown = useCallback(
		async (event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter" && app !== null) {
				try {
					const { id } = await app.actions.createMessage(value)
					setValue("")
				} catch (err) {
					console.log(err)
					console.error(err)
				}
			}
		},
		[app, value],
	)

	if (app === null) {
		return null
	}

	return (
		<input
			autoFocus
			className="my-2 px-2 py-1 border rounded"
			type="text"
			value={value}
			onChange={(event) => setValue(event.target.value)}
			onKeyDown={handleKeyDown}
			placeholder="Send a message..."
		/>
	)
}
