"use client"

import { useEffect, useMemo, useState } from "react"
import { BrowserProvider } from "ethers"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { topic } from "../../contract.canvas.mjs"
import { Action, Message, Session } from "@canvas-js/interfaces"
import { stringify } from "@ipld/dag-json"

interface User {
	signer: SIWESigner
	id: string
}

interface ChatMessage {
	id: string
	address: string
	content: string
	timestamp: number
}

export default function Home() {
	const provider = useMemo(() => {
		return new BrowserProvider(window.ethereum)
	}, [])

	const burnerWallet = useMemo(() => {
		return new SIWESigner({ chainId: 1 })
	}, [])

	const [mmUser, setMMUser] = useState<User>()
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [inputValue, setInputValue] = useState<string>("")

	// Check on page load whether a user is signed in with MM
	useEffect(() => {
		if (window.ethereum) {
			window.ethereum.request({ method: "eth_accounts" }).then(async (accounts: any) => {
				if (accounts.length > 0) {
					const ethSigner = await provider.getSigner()
					const network = await provider.getNetwork()

					const canvasSigner = new SIWESigner({ signer: ethSigner, chainId: Number(network.chainId) })

					setMMUser({ signer: canvasSigner, id: ethSigner.address })
				} else {
					console.log("No accounts connected")
					setMMUser(undefined)
				}
			})

			window.ethereum.on("accountsChanged", (accounts: any) => {
				console.log("accounts :>> ", accounts)

				if (accounts.length === 0) {
					setMMUser(undefined)
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

	useEffect(() => {
		console.log("messages :>> ", messages)
	}, [messages])

	const connectEth = async () => {
		try {
			// This call actually prompts the user to connect via metamask,
			// *only* during the first activation, when accounts :>> []
			// If this call does not throw an exception, we can assume
			// `ethSigner` has a value
			const ethSigner = await provider.getSigner()
			const network = await provider.getNetwork()

			const canvasSigner = new SIWESigner({ signer: ethSigner, chainId: Number(network.chainId) })

			setMMUser({ signer: canvasSigner, id: ethSigner.address })
		} catch (err) {
			console.log("err :>> ", err)
		}
	}

	const getClockValues = async () => {
		try {
			const response = await fetch("/getClock")
			if (!response.ok) {
				throw new Error("Network response was not ok")
			}
			const data = await response.json()
			return { nextClockValue: data.nextClockValue, parentMessageIds: data.parentMessageIds }
		} catch (error) {
			console.error("Error fetching clock values:", error)
			throw error
		}
	}

	const checkSession = async () => {
		const activeSigner = mmUser?.signer || burnerWallet
		const timestamp = Date.now()

		const session = await activeSigner.getSession(topic, { timestamp })

		const response = await fetch("/getSession", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: stringify({
				session: {
					publicKey: session.publicKey,
					address: session.address,
					timestamp: session.timestamp,
				},
			}),
		})

		const body: { message_id: string | null } = await response.json()

		return {
			messageId: body.message_id,
			session,
		}
	}

	const insertChatMessage = async ({ clockValues, session }: any) => {
		const activeSigner = mmUser?.signer || burnerWallet
		const timestamp = Date.now()

		const actionPayload: Action = {
			type: "action",
			address: session.address,
			name: "createMessage",
			args: { content: inputValue },
			timestamp,
			blockhash: null,
		}

		const message: Message<Action> = {
			topic: topic,
			clock: clockValues.nextClockValue,
			parents: clockValues.parentMessageIds,
			payload: actionPayload,
		}

		const signature = await activeSigner.sign(message)

		const response = await fetch("/insert", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: stringify({
				signature,
				message,
			}),
		})

		return { response }
	}

	const registerSessionAndInsertChatMessage = async ({ clockValues, session }: any) => {
		const message: Message<Session> = {
			topic: topic,
			clock: clockValues.nextClockValue,
			parents: clockValues.parentMessageIds,
			payload: session,
		}

		const activeSigner = mmUser?.signer || burnerWallet
		const signature = await activeSigner.sign(message)

		const response = await fetch("/insert", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: stringify({
				signature,
				message,
			}),
		})

		const { message_id }: { message_id: string | null } = await response.json()

		if (message_id === null) {
			console.log("Failed to insert session message")
			return
		}

		const newClockValues = {
			nextClockValue: clockValues.nextClockValue + 1,
			parentMessageIds: [message_id],
		}

		insertChatMessage({ session, clockValues: newClockValues })
	}

	const sendMessage = async () => {
		if (inputValue.trim() !== "") {
			try {
				const sessionData = await checkSession()
				const clockValues = await getClockValues()

				if (sessionData.messageId === null) {
					await registerSessionAndInsertChatMessage({ session: sessionData.session, clockValues })
				} else {
					await insertChatMessage({ session: sessionData.session, clockValues })
				}

				setInputValue("")
			} catch (error) {
				console.error("Error sending message:", error)
			}
		}
	}

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

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			sendMessage()
		}
	}

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setInputValue(e.target.value)
	}

	return (
		<div className="w-[600px] p-4 flex flex-col h-screen">
			<section className="login-section flex-none pb-2">
				{mmUser && (
					<div>
						<span>[Metamask] Signed in as: </span>
						<span className="text-teal-500">{mmUser.id.slice(0, 10)}...</span>
					</div>
				)}

				{!mmUser && (
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
						onChange={handleInputChange}
						onKeyDown={handleKeyDown}
					/>
				</div>
			</section>
		</div>
	)
}
