import React from "react"
import { ChatView } from "./ChatView"
import { LoginView } from "./LoginView"

export const App: React.FC<{}> = ({}) => {
	const [isLoggedIn, setIsLoggedIn] = React.useState(false)

	if (isLoggedIn) {
		return <ChatView />
	} else {
		return <LoginView />
	}
}
