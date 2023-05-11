import React from "react"
import { ChatView } from "./views/ChatView"
import { EnterPinView } from "./views/EnterPinView"
import { SelectWalletView, WalletName } from "./views/SelectWalletView"

const useAccount = ():
	| {
			page: "selectWallet"
			isLoggedIn: false
			selectWallet: (wallet: WalletName) => void
	  }
	| {
			page: "enterPin"
			selectedWallet: WalletName
			isLoggedIn: false
			submitPin: (pin: string) => void
	  }
	| {
			page: "chat"
			isLoggedIn: true
			encryptMessage: (message: string) => string
			signMessage: (message: string) => string
	  } => {
	const [selectedWallet, setSelectedWallet] = React.useState<WalletName | null>(null)
	const [page, setPage] = React.useState<"selectWallet" | "enterPin" | "chat">("selectWallet")

	if (page === "selectWallet") {
		return {
			page,
			isLoggedIn: false,
			selectWallet: (wallet: WalletName) => {
				setSelectedWallet(wallet)
				setPage("enterPin")
			},
		}
	} else if (page === "enterPin") {
		const submitPin = (pin: string) => {
			setPage("chat")
		}

		return {
			page,
			selectedWallet: selectedWallet!,
			isLoggedIn: false,
			submitPin,
		}
	} else if (page === "chat") {
		const encryptMessage = (message: string) => ""
		const signMessage = (message: string) => ""
		return {
			page,
			isLoggedIn: true,
			encryptMessage,
			signMessage,
		}
	} else {
		throw new Error(`Unknown page: ${page}`)
	}
}

export const App: React.FC<{}> = ({}) => {
	const data = useAccount()

	if (data.page === "selectWallet") {
		return <SelectWalletView selectWallet={data.selectWallet} />
	} else if (data.page === "enterPin") {
		return <EnterPinView submitPin={data.submitPin} />
	} else if (data.page === "chat") {
		// encryptMessage={data.encryptMessage} signMessage={data.signMessage}
		return <ChatView />
	} else {
		throw new Error(`Unknown page`)
	}
}
