import { useState, useEffect, useRef } from "react"
import { encryptSafely, decryptSafely, getEncryptionPublicKey } from "@metamask/eth-sig-util"
import { ethers } from "ethers"
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"
import { SIWESigner } from "@canvas-js/chain-ethereum"

import { usePrivkey } from "./components/privkeys"

const toCAIP = (address: string) => {
	return "eip155:1:" + address
}
const fromCAIP = (address: string) => {
	return address.replace("eip155:1:", "")
}
const getGroupId = (address1: string, address2: string) => {
	return address1 < address2 ? `${address1},${address2}` : `${address1},${address2}`
}

const useChat = (topic: string, wallet: ethers.Wallet) => {
	const { app } = useCanvas({
		signers: [new SIWESigner({ signer: wallet })],
		contract: {
			topic,
			models: {
				encryptionKeys: {
					address: "primary",
					key: "string",
				},
				encryptionGroups: {
					id: "primary",
					members: "string",
					groupKeys: "string",
					key: "string",
				},
				messages: {
					id: "primary",
					address: "string",
					text: "string",
					timestamp: "string",
					$indexes: [["timestamp"] /*["address", "timestamp"]*/],
				},
				privateMessages: {
					id: "primary",
					ciphertext: "string",
					group: "string",
					timestamp: "integer",
					$indexes: [["timestamp"]],
				},
			},
			actions: {
				registerEncryptionKey: (db, { key }, { address }) => {
					db.encryptionKeys.set({ address, key })
				},
				createEncryptionGroup: (db, { members, groupKeys, groupPublicKey }, { address }) => {
					// TODO: enforce the encryption group is valid
					if (members.indexOf(fromCAIP(address)) === -1) throw new Error()
					const id = members.join()

					db.encryptionGroups.set({
						id,
						members: JSON.stringify(members),
						groupKeys: JSON.stringify(groupKeys),
						key: groupPublicKey,
					})
				},
				sendLobbyMessage: (db, { text }, { address, timestamp, id }) => {
					db.messages.set({ msgid: id, address: address, text, timestamp })
				},
				sendPrivateMessage: (db, { group, ciphertext }, { timestamp, id }) => {
					// TODO: check address is in group
					db.privateMessages.set({ id, ciphertext, group, timestamp })
				},
			},
		},
	})

	const people = useLiveQuery(app, "encryptionKeys", { orderBy: { address: "desc" } })
	// const lobby = useLiveQuery(app, "messages", { orderBy: { timestamp: "desc" } })

	return {
		wallet,
		app,
		people,
		sendLobbyMessage: async (message: string) => {
			if (!app) throw new Error()
			return app.actions.sendLobbyMessage(message)
		},
		registerEncryptionKey: async (privateKey: string) => {
			if (!app) throw new Error()
			const key = getEncryptionPublicKey(privateKey.slice(2))
			return app.actions.registerEncryptionKey({ key })
		},
		createEncryptionGroup: async (recipient: string) => {
			if (!app) throw new Error()
			if (!wallet) throw new Error()

			const myKey = await app.db.get("encryptionKeys", toCAIP(wallet.address))
			if (!myKey) throw new Error("Wallet has not registered an encryption key")

			const recipientKey = await app.db.get("encryptionKeys", toCAIP(recipient))
			if (!recipientKey) throw new Error("Recipient has not registered an encryption key")

			const members = [wallet.address, recipient]
			const group = getGroupId(wallet.address, recipient)

			const groupPrivateKey = ethers.Wallet.createRandom().privateKey
			const groupPublicKey = getEncryptionPublicKey(groupPrivateKey.slice(2))
			const groupKeys = (await Promise.all(members.map((member) => app.db.get("encryptionKeys", toCAIP(member)))))
				.map((result) => result.key)
				.map((key) => {
					return encryptSafely({ publicKey: key as string, data: groupPrivateKey, version: "x25519-xsalsa20-poly1305" })
				})

			return app.actions.createEncryptionGroup({ id: group, members, groupKeys, groupPublicKey })
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
			console.log(encryptedData)
			const ciphertext = JSON.stringify(encryptedData)
			console.log(ciphertext)

			return app.actions.sendPrivateMessage({ group, ciphertext })
		},
	}
}

// const chat = useChat('my-app', mud.burnerWallet.privateKey)
// chat.sendLobbyMessage('hi')
// chat.sendPrivateMessage('hey whats going on', theirAddress)
// const messages = useLobby() // useLobbyConversation?
// const privateMessages = usePrivateMessages() // does this need separate hooks for DMSelector, DMConversation?

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
	const { app, people, registerEncryptionKey, createEncryptionGroup, /*sendLobbyMessage,*/ sendPrivateMessage } =
		useChat("example-topic", wallet1)

	const { registerEncryptionKey: registerEncryptionKey2 } = useChat("example-topic", wallet2)

	const registration1 = useLiveQuery(app, "encryptionKeys", { where: { address: toCAIP(wallet1?.address) } })
	const registration2 = useLiveQuery(app, "encryptionKeys", { where: { address: toCAIP(wallet2?.address) } })

	const groups = useLiveQuery(app, "encryptionGroups", {
		where: { id: getGroupId(wallet1.address, wallet2.address) },
	})

	const messages = useLiveQuery(app, "privateMessages", {
		where: { group: getGroupId(wallet1.address, wallet2.address) },
	})

	// TODO: const [conversation, setConversation] = useState<string>()

	const inputRef = useRef<HTMLInputElement>(null)

	return (
		<>
			<div style={{ display: "flex", height: "100vh" }}>
				<div style={{ width: 200 }}>
					<h3>Conversations</h3>
					<div>
						<div>Lobby</div>
						<div>DM Guest1</div>
						<div>DM Guest2</div>
						<div>DM Guest3</div>
						<br />
						{people?.map((person) => (
							<div key={person.address as string}>
								{person.address} {person.key}
							</div>
						))}
						<br />
					</div>
					<div style={{ marginTop: 40 }}>
						<div>
							My address: {wallet1?.address}{" "}
							{registration1?.length === 0 && (
								<button
									onClick={() => {
										if (!wallet1) return
										registerEncryptionKey(wallet1.privateKey)
									}}
								>
									Register
								</button>
							)}
						</div>
						<div>
							Their address: {wallet2?.address}{" "}
							{registration2?.length === 0 && (
								<button
									onClick={() => {
										if (!wallet2) return
										registerEncryptionKey2(wallet2.privateKey)
									}}
								>
									Register
								</button>
							)}
						</div>
						<div>
							{groups && groups?.length > 0 ? (
								<div>
									<div>{messages?.length} messages</div>
									{messages?.map((message) => (
										<Message wallet={wallet1} key={message.id as string} message={message} groups={groups} />
									))}
									<form
										onSubmit={(e) => {
											e.preventDefault()
											if (!inputRef.current) return
											sendPrivateMessage(wallet2.address, inputRef.current.value).then(() => {
												if (inputRef.current === null) return
												inputRef.current.value = ""
											})
										}}
									>
										<input ref={inputRef} type="text" placeholder="Type a message..." />
									</form>
								</div>
							) : (
								<button
									onClick={() => {
										if (!wallet2) return
										createEncryptionGroup(wallet2.address)
										// TODO: page won't refresh until the first core gets updated
										// we might be missing a refresh trigger
									}}
								>
									Create encryption group
								</button>
							)}
						</div>
					</div>
				</div>
				<div style={{ flex: 1 }}>
					<h3>Chatbox</h3>
					<div>hello world</div>
				</div>
			</div>
		</>
	)
}

const Message = ({ wallet, message, groups }) => {
	const [decryptedMessage, setDecryptedMessage] = useState<string>()

	const privateKey = wallet.privateKey
	const { group, ciphertext } = message

	useEffect(() => {
		const groupObj = groups.find((g) => g.id === group)
		const groupKeys = groupObj && JSON.parse(groupObj?.groupKeys)

		const decrypted = groupKeys
			?.map((encryptedData) => {
				try {
					return decryptSafely({ encryptedData, privateKey: privateKey.slice(2) })
				} catch (err) {
					return null
				}
			})
			.filter((value: string | null) => value)
		if (!decrypted) return

		const decryptionKey = decrypted[0]
		const encryptedData = JSON.parse(ciphertext)
		const decryptedMessage = decryptSafely({ encryptedData, privateKey: decryptionKey.slice(2) })
		setDecryptedMessage(decryptedMessage)
	}, [privateKey, group, ciphertext, groups])

	// console.log(groupKeys, encryptionKey)
	// decryptSafely(

	return <div>message: {decryptedMessage}</div>
}

export default Wrapper
