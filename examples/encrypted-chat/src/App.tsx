import { useState, useEffect, useRef } from "react"
import { decryptSafely, EthEncryptedData } from "@metamask/eth-sig-util"
import { ethers } from "ethers"

import type { Canvas } from "@canvas-js/core"
import { useLiveQuery } from "@canvas-js/hooks"
import { usePrivateChat } from "@canvas-js/hooks/ethers"
import { SIWESigner } from "@canvas-js/chain-ethereum"

import { usePrivkey } from "./components/privkeys"

const formatAddress = (address: string | null | undefined) => {
	return address?.slice(0, 6)
}
const toCAIP = (address: string) => {
	return "eip155:1:" + address
}
const fromCAIP = (address: string) => {
	return address.replace("eip155:1:", "")
}
const getGroupId = (address1: string, address2: string) => {
	return address1 < address2 ? `${address1},${address2}` : `${address1},${address2}`
}

function Wrapper() {
	const privkey1 = usePrivkey("wallet-privkey1")
	const privkey2 = usePrivkey("wallet-privkey2")

	const [wallet1, setWallet1] = useState<ethers.Wallet>()
	const [wallet2, setWallet2] = useState<ethers.Wallet>()

	useEffect(() => {
		if (!privkey1 || !privkey2) return
		setWallet1(new ethers.Wallet(privkey1))
		setWallet2(new ethers.Wallet(privkey2))
	}, [privkey1, privkey2])

	if (wallet1 && wallet2) {
		return <App wallet1={wallet1} wallet2={wallet2} />
	} else {
		return <></>
	}
}

function App({ wallet1, wallet2 }: { wallet1: ethers.Wallet; wallet2: ethers.Wallet }) {
	const { app, people, sendPrivateMessage, selectConversation, conversationAddress } = usePrivateChat({
		topic: "xyz.canvas.example-topic",
		discoveryTopic: "xyz.canvas.encrypted-chat-discovery",
		signers: [new SIWESigner({ signer: wallet1 })],
		wallet: wallet1,
	})

	const {} = usePrivateChat({
		topic: "xyz.canvas.example-topic",
		discoveryTopic: "xyz.canvas.encrypted-chat",
		signers: [new SIWESigner({ signer: wallet2 })],
		wallet: wallet2,
	})

	return (
		<div style={{ height: "100vh" }}>
			<div style={{ display: "flex", height: "calc(100vh - 120px)" }}>
				{/* conversation selector */}
				<div style={{ width: 200 }}>
					<h3>Conversations</h3>
					<div>
						{people?.map((person) => {
							const key = person.key as string
							const address = person.address as string
							return (
								<button
									key={person.address as string}
									style={{ width: "100%", textAlign: "left" }}
									onClick={() => selectConversation(address)}
								>
									{formatAddress(fromCAIP(address))} <span title={key}>🔐</span>{" "}
									{fromCAIP(address) === wallet1?.address && <span>[You]</span>}
									{fromCAIP(address) === wallet2?.address && <span>[Guest]</span>}
								</button>
							)
						})}
						<br />
					</div>
				</div>
				{/* conversation content */}
				<div style={{ flex: 1 }}>
					<h3>Chatbox</h3>
					<div>
						{app && conversationAddress && (
							<Conversation
								app={app}
								wallet={wallet1}
								conversationAddress={fromCAIP(conversationAddress)}
								sendPrivateMessage={sendPrivateMessage}
							/>
						)}
					</div>
				</div>
			</div>
			<div style={{ marginTop: 40 }}>
				{/* login and reset buttons */}
				<div>
					<button
						onClick={async () => {
							const dbs = await window.indexedDB.databases()
							dbs.forEach((db) => db.name && window.indexedDB.deleteDatabase(db.name))
							location.reload()
						}}
					>
						Reset
					</button>
				</div>
			</div>
		</div>
	)
}

const Conversation = ({
	app,
	wallet,
	conversationAddress,
	sendPrivateMessage,
}: {
	app: Canvas
	wallet: ethers.Wallet
	conversationAddress: string
	sendPrivateMessage: (recipient: string, message: string) => Promise<void>
}) => {
	const groups = useLiveQuery(app, "encryptionGroups", {
		where: { id: getGroupId(wallet.address, conversationAddress) },
	})

	const messages = useLiveQuery(app, "privateMessages", {
		where: { group: getGroupId(wallet.address, conversationAddress) },
	})

	const inputRef = useRef<HTMLInputElement>(null)

	return (
		<div>
			<div>You and {formatAddress(conversationAddress)}</div>
			<div>{messages?.length} messages</div>
			{messages?.map((message) => (
				<Message
					wallet={wallet}
					key={message.id as string}
					message={message as { group: string; ciphertext: string }}
					groups={groups as Array<{ id: string; groupKeys: string }>}
				/>
			))}
			{groups?.length !== 0 && (
				<form
					onSubmit={(e) => {
						e.preventDefault()
						if (!inputRef.current) return
						sendPrivateMessage(conversationAddress, inputRef.current.value).then(() => {
							if (inputRef.current === null) return
							inputRef.current.value = ""
						})
					}}
				>
					<input ref={inputRef} type="text" placeholder="Type a message..." />
				</form>
			)}
		</div>
	)
}

const Message = ({
	wallet,
	message,
	groups,
}: {
	wallet: ethers.Wallet
	message: { group: string; ciphertext: string }
	groups: Array<{ id: string; groupKeys: string }>
}) => {
	const [decryptedMessage, setDecryptedMessage] = useState<string>()
	const [decryptedFromAddress, setDecryptedFromAddress] = useState<string>()

	const privateKey = wallet.privateKey
	const { group, ciphertext } = message

	useEffect(() => {
		const groupObj = groups.find((g) => g.id === group)
		const groupKeys = groupObj && JSON.parse(groupObj?.groupKeys)
		const groupAddresses = groupObj?.id.split(",")

		const decrypted =
			groupAddresses &&
			groupKeys
				?.map((encryptedData: EthEncryptedData, index: number) => {
					try {
						const decryptionKey = decryptSafely({ encryptedData, privateKey: privateKey.slice(2) })
						return [decryptionKey, groupAddresses[index]]
					} catch (err) {
						return null
					}
				})
				.filter((value: string | null) => value)
		if (!decrypted) return

		const [decryptionKey, fromAddress] = decrypted[0]
		const encryptedData = JSON.parse(ciphertext)
		try {
			const decryptedMessage = decryptSafely({ encryptedData, privateKey: decryptionKey.slice(2) })
			setDecryptedFromAddress(fromAddress)
			setDecryptedMessage(decryptedMessage)
		} catch (err) {
			setDecryptedMessage("Message could not be decrypted.")
		}
	}, [privateKey, group, ciphertext, groups])

	return (
		<div>
			{formatAddress(decryptedFromAddress)}: {decryptedMessage}
		</div>
	)
}

export default Wrapper
