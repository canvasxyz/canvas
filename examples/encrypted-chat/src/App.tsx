import { useState, useEffect, useRef } from "react"
import { encryptSafely, decryptSafely, getEncryptionPublicKey, EthEncryptedData } from "@metamask/eth-sig-util"
import { ethers } from "ethers"

import type { Canvas } from "@canvas-js/core"
import { useCanvas, useLiveQuery, AppInfo } from "@canvas-js/hooks"
import { SIWESigner } from "@canvas-js/signer-ethereum"

import { usePrivkey } from "./components/privkeys"
import EncryptedChat from "./contract"

const wsURL = import.meta.env.VITE_CANVAS_WS_URL ?? null
console.log("websocket API URL:", wsURL)

const formatAddress = (address: string | null | undefined) => {
	return address?.slice(0, 6)
}
const getGroupId = (address1: string, address2: string) => {
	return address1 < address2 ? `${address1},${address2}` : `${address1},${address2}`
}

const useChat = (wallet: ethers.Wallet) => {
	const { app, ws } = useCanvas(wsURL, {
		signers: [new SIWESigner({ signer: wallet })],
		contract: EncryptedChat,
	})

	const people = useLiveQuery<typeof EncryptedChat.models, "encryptionKeys">(app, "encryptionKeys", {
		orderBy: { address: "desc" },
	})

	return {
		wallet,
		app,
		ws,
		people,
		registerEncryptionKey: async (privateKey: string) => {
			if (!app) throw new Error()
			const key = getEncryptionPublicKey(privateKey.slice(2))
			return app.actions.registerEncryptionKey({ key })
		},
		createEncryptionGroup: async (recipient: string) => {
			if (!app) throw new Error()
			if (!wallet) throw new Error()

			const myKey = await app.db.get("encryptionKeys", wallet.address)
			if (!myKey) throw new Error("Wallet has not registered an encryption key")

			const recipientKey = await app.db.get("encryptionKeys", recipient)
			if (!recipientKey) throw new Error("Recipient has not registered an encryption key")

			const members = [wallet.address, recipient]

			const groupPrivateKey = ethers.Wallet.createRandom().privateKey
			const groupPublicKey = getEncryptionPublicKey(groupPrivateKey.slice(2))
			const groupKeys = (await Promise.all(members.map((member) => app.db.get("encryptionKeys", member))))
				.map((result) => result?.key)
				.map((key) => {
					return encryptSafely({ publicKey: key as string, data: groupPrivateKey, version: "x25519-xsalsa20-poly1305" })
				})

			await app.actions.createEncryptionGroup({ members, groupKeys, groupPublicKey })
		},
		sendPrivateMessage: async (recipient: string, message: string) => {
			if (!app) throw new Error()
			if (!wallet?.address) throw new Error()

			const address = wallet?.address
			const group = getGroupId(address, recipient)
			const encryptionGroup = await app.db.get("encryptionGroups", group)

			if (!encryptionGroup) throw new Error("Invalid group")

			const encryptedData = encryptSafely({
				publicKey: encryptionGroup.key as string,
				data: message,
				version: "x25519-xsalsa20-poly1305",
			})
			const ciphertext = JSON.stringify(encryptedData)
			await app.actions.sendPrivateMessage({ group, ciphertext })
		},
	}
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
	const { app, ws, people, registerEncryptionKey, createEncryptionGroup, sendPrivateMessage } = useChat(wallet1)

	const { registerEncryptionKey: registerEncryptionKey2 } = useChat(wallet2)

	const registration1 = useLiveQuery<typeof EncryptedChat.models, "encryptionKeys">(app, "encryptionKeys", {
		where: { address: wallet1?.address },
	})
	const registration2 = useLiveQuery<typeof EncryptedChat.models, "encryptionKeys">(app, "encryptionKeys", {
		where: { address: wallet2?.address },
	})

	const [conversationAddress, setConversationAddress] = useState<string>()

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
									onClick={() => setConversationAddress(address)}
								>
									{formatAddress(address)} <span title={key}>🔐</span>{" "}
									{address === wallet1?.address && <span>[You]</span>}
									{address === wallet2?.address && <span>[Guest]</span>}
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
								conversationAddress={conversationAddress}
								sendPrivateMessage={sendPrivateMessage}
								createEncryptionGroup={createEncryptionGroup}
							/>
						)}
					</div>
				</div>
				<AppInfo app={app} ws={ws} />
			</div>
			<div style={{ marginTop: 40 }}>
				{/* login and reset buttons */}
				<div>
					<button
						disabled={registration1?.length !== 0}
						onClick={async () => {
							if (!wallet1) return
							await registerEncryptionKey(wallet1.privateKey)
						}}
					>
						{registration1?.length === 0 ? "Register [You]" : "Logged in [You]"}
					</button>
					<button
						disabled={registration2?.length !== 0}
						onClick={async () => {
							if (!wallet2) return
							await registerEncryptionKey2(wallet2.privateKey)
							window.location.reload() // TODO: two apps should talk to each other
						}}
					>
						{registration2?.length === 0 ? "Register [Guest]" : "Logged in [Guest]"}
					</button>
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
	createEncryptionGroup,
	sendPrivateMessage,
}: {
	app: Canvas
	wallet: ethers.Wallet
	conversationAddress: string
	createEncryptionGroup: (recipient: string) => Promise<void>
	sendPrivateMessage: (recipient: string, message: string) => Promise<void>
}) => {
	const groups = useLiveQuery<typeof EncryptedChat.models, "encryptionGroups">(app, "encryptionGroups", {
		where: { id: getGroupId(wallet.address, conversationAddress) },
	})

	const messages = useLiveQuery<typeof EncryptedChat.models, "privateMessages">(app, "privateMessages", {
		where: { group: getGroupId(wallet.address, conversationAddress) },
	})

	const inputRef = useRef<HTMLInputElement>(null)

	return (
		<div>
			<div>You and {formatAddress(conversationAddress)}</div>
			<div>{messages?.length} messages</div>
			{groups?.length === 0 && (
				<button
					onClick={async () => {
						await createEncryptionGroup(conversationAddress)
					}}
				>
					Create encryption group
				</button>
			)}
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
