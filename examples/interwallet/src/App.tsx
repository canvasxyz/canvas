import React, { useEffect, useMemo, useState } from "react"
import { sha256 } from "@noble/hashes/sha256"

import { ChatView } from "./views/ChatView"
import { EnterPinView } from "./views/EnterPinView"
import { SelectWalletView } from "./views/SelectWalletView"
import {
	buildMagicString,
	makeKeyBundle,
	metamaskEncryptData,
	metamaskGetPublicKey,
	signKeyBundle,
} from "./cryptography"
import { useAccount, useConnect } from "wagmi"

import { Room, UserRegistration } from "./models"
import { useStore } from "./useStore"

const useUtf8Store = <T,>(url: string, apply: (key: string, value: T) => void) => {
	const { store } = useStore(url, async (key, value) => {
		const keyUtf8 = Buffer.from(key).toString("utf8")
		const valueUtf8 = JSON.parse(Buffer.from(value).toString("utf8"))
		return apply(keyUtf8, valueUtf8)
	})

	if (store === null) {
		return null
	} else {
		const insert = (key: string, value: T) => {
			const keyUint8array = Buffer.from(key, "utf8")
			const valueUint8array = Buffer.from(JSON.stringify(value), "utf8")
			store.insert(keyUint8array, valueUint8array)
		}

		return { insert }
	}
}

const toRoomKey = (address1: string, address2: string) => {
	const addresses = [address1, address2].sort()
	return addresses.join("-")
}

export const App: React.FC<{}> = ({}) => {
	const { connect, connectors } = useConnect()
	const { address, isConnected } = useAccount()
	const [privateKey, setPrivateKey] = useState<Buffer | null>(null)

	const [userRegistrations, setUserRegistrations] = useState<{ [key: string]: UserRegistration }>({})

	const userStore = useUtf8Store<UserRegistration>(
		"ws://localhost:8765/userRegistrations",
		async (address, userRegistration) => {
			setUserRegistrations((existingUserRegistrations) => ({
				...existingUserRegistrations,
				[address]: userRegistration,
			}))
		}
	)

	const [rooms, setRooms] = useState<{ [key: string]: Room }>({})
	const roomsStore = useUtf8Store<Room>("ws://localhost:8765/rooms", async (roomKey, room) => {
		setRooms((existingRooms) => ({ ...existingRooms, [roomKey]: room }))
	})

	useEffect(() => {
		if (privateKey !== null && address && userStore) {
			const keyBundle = makeKeyBundle(privateKey)
			signKeyBundle(address, keyBundle).then((signature: string) => {
				userStore.insert(address, { signature, payload: keyBundle })
			})
		}
	}, [privateKey, userStore])

	const startChat = useMemo(
		() => (otherAddress: string) => {
			if (!roomsStore) return
			if (!address) return

			const key = toRoomKey(address, otherAddress)
			if (!Object.keys(rooms).includes(key)) {
				roomsStore.insert(key, {
					members: [address, otherAddress],
					sharedKey: [],
					sharedKeyHash: "",
				})
			}
		},
		[address]
	)

	console.log(userRegistrations)

	// if not connected to wallet, then show the select wallet view
	if (!isConnected) {
		return (
			<SelectWalletView
				selectWallet={(wallet) => {
					connect({ connector: connectors[0] })
				}}
			/>
		)
	}

	if (privateKey === null) {
		return (
			<EnterPinView
				submitPin={async (pin) => {
					const magicString = buildMagicString(pin)

					const metamaskPubKey = await metamaskGetPublicKey(address!)
					const secretSignature = metamaskEncryptData(metamaskPubKey, Buffer.from(magicString))
					setPrivateKey(Buffer.from(sha256(secretSignature)))
				}}
			/>
		)
	}

	return (
		<ChatView
			myAddress={address!}
			privateKey={privateKey}
			rooms={rooms}
			startChat={startChat}
			userRegistrations={userRegistrations}
		/>
	)
}
