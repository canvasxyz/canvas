import React from "react"
import { ChatView } from "./views/ChatView"
import { EnterPinView } from "./views/EnterPinView"

export const App: React.FC<{}> = ({}) => {
	const [isLoggedIn, setIsLoggedIn] = React.useState(false)

	if (isLoggedIn) {
		return <ChatView />
	} else {
		return <EnterPinView />
	}
}
