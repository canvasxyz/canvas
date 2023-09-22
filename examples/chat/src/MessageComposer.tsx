import React, { useCallback, useContext, useState } from "react"

import { AppContext } from "./AppContext.js"

export interface MessageComposerProps {}

export const MessageComposer: React.FC<MessageComposerProps> = ({}) => {
	const { app, sessionSigner: signer } = useContext(AppContext)

	const [value, setValue] = useState("")

	const handleKeyDown = useCallback(
		async (event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter" && app !== null && signer !== null) {
				try {
					const { id, result, recipients } = await app.actions.createMessage({ content: value }, { signer })
					setValue("")
				} catch (err) {
					console.error(err)
				}
			}
		},
		[app, signer, value]
	)

	if (app === null || signer === null) {
		return null
	}

	return (
		<input
			className="my-2 px-2 py-1 border rounded"
			type="text"
			value={value}
			onChange={(event) => setValue(event.target.value)}
			onKeyDown={handleKeyDown}
			placeholder="Send a message..."
		/>
	)
}
