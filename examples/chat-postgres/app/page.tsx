"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BrowserProvider } from "ethers"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Action, Message, Session } from "@canvas-js/interfaces"
import { Client } from "@canvas-js/client"

const topic = "chat-example.canvas.xyz"

interface ChatMessage {
	id: string
	address: string
	content: string
	timestamp: number
}

const burnerWallet = new SIWESigner()

export default function Home() {
	const provider = useMemo(() => {
		if (typeof window !== "undefined" && window.ethereum) {
			return new BrowserProvider(window.ethereum)
		}

		return undefined
	}, [])

	const [address, setAddress] = useState<string | null>(null)
	const [client, setClient] = useState(new Client(burnerWallet, "/api", topic))

	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [inputValue, setInputValue] = useState<string>("")

	// Check on page load whether a user is signed in with MM
	useEffect(() => {
		if (typeof window !== "undefined" && window.ethereum && provider) {
			window.ethereum.request({ method: "eth_accounts" }).then(async (accounts: string[]) => {
				if (accounts.length > 0) {
					const ethSigner = await provider.getSigner()
					const network = await provider.getNetwork()

					const signer = new SIWESigner({ signer: ethSigner, chainId: Number(network.chainId) })
					setClient(new Client(signer, "/api", topic))
					setAddress(ethSigner.address)
				} else {
					console.log("No accounts connected")
				}
			})

			window.ethereum.on("accountsChanged", (accounts: string[]) => {
				if (accounts.length === 0) {
					setClient(new Client(burnerWallet, "/api", topic))
					setAddress(null)
				}
			})
		}
	}, [])

	// Long-poll the server for new messages
	useEffect(() => {
		const intervalId = setInterval(() => {
			fetch("/read")
				.then((response) => response.json())
				.then((data) => {
					setMessages(data.messages)
				})
				.catch((error) => {
					console.error("Error fetching messages:", error)
				})
		}, 1000)

		return () => clearInterval(intervalId)
	}, [])

	const connectEth = useCallback(async () => {
		if (provider === undefined) {
			return
		}

		try {
			// `provider.getSigner()` prompts the metamask extension to
			// open the accounts screen, but only when the accounts
			// array is empty. If it doesn't throw an exception, we can
			// assume `ethSigner` has a value
			const ethSigner = await provider.getSigner()
			const network = await provider.getNetwork()
			const signer = new SIWESigner({ signer: ethSigner, chainId: Number(network.chainId) })
			setClient(new Client(signer, "/api", topic))
			setAddress(ethSigner.address)
		} catch (err) {
			console.log("err :>> ", err)
		}
	}, [provider])

	const formatMessageTime = (timestamp: number) => {
		const date = new Date(timestamp)
		const timeString = date.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		})
		const amPm = date.getHours() >= 12 ? "pm" : "am"
		return timeString.replace(" ", "") + amPm
	}

	const getMessages = () => {
		return messages.map((message) => {
			return (
				<div className="mb-1 flex items-center">
					<span className="text-gray-500 text-sm mr-1 font-mono">[{formatMessageTime(message.timestamp)}]</span>
					<span className="flex">
						<span className="text-sm flex-none font-mono mr-2">{message.address.slice(9, 15)}:</span>
						<span className="text-sm flex-grow">{message.content}</span>
					</span>
				</div>
			)
		})
	}

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key !== "Enter") {
				return
			}

			const content = inputValue.trim()
			if (content === "") {
				return
			}

			client.sendAction("createMessage", { content }).then(
				() => setInputValue(""),
				(err) => console.error("Error sending message:", err),
			)
		},
		[inputValue, client],
	)

	return (
		<div className="w-[600px] p-4 flex flex-col h-screen">
			<section className="login-section flex-none pb-2">
				{address && (
					<div>
						<span>[Metamask] Signed in as: </span>
						<span className="text-teal-500">{address.slice(0, 10)}...</span>
					</div>
				)}

				{address === null && provider && (
					<div className="flex justify-between align-middle">
						<div>
							<span>Not signed in, using: </span>
							<span className="text-teal-500">{burnerWallet.key}</span>
						</div>
						<div>
							<button
								onClick={connectEth}
								className="btn bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm"
							>
								Connect Metamask
							</button>
						</div>
					</div>
				)}
			</section>
			<section className="chat-section border border-gray-300 flex-grow overflow-auto flex flex-col">
				<div className="chat-messages flex-grow p-2">{getMessages()}</div>
				<div className="chat-input flex-none border-t-2">
					<input
						type="text"
						placeholder="Type a message..."
						className="w-full p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:border-transparent"
						value={inputValue}
						onChange={(event) => setInputValue(event.target.value)}
						onKeyDown={handleKeyDown}
					/>
				</div>
			</section>
		</div>
	)
}
