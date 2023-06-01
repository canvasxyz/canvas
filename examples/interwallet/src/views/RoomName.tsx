import React, { useContext, useEffect, useMemo, useState } from "react"
import { Room } from "../db"
import { fetchEnsName } from "@wagmi/core"

import { AppContext } from "../context"
import { getAddress } from "viem"

export interface RoomNameProps {
	room: Room
}

export const RoomName: React.FC<RoomNameProps> = ({ room }) => {
	const [ensName, setEnsName] = useState<string | null>(null)

	if (room.members.length !== 2) {
		throw new Error("rooms must have exactly two members")
	}

	const { user } = useContext(AppContext)

	const recipient = useMemo(
		() => user && room.members.find(({ address }) => getAddress(address) !== user.address),
		[room, user]
	)

	useEffect(() => {
		if (recipient) {
			fetchEnsName({ address: recipient.address }).then((name) => setEnsName(name))
		}
	}, [recipient])

	if (ensName) {
		return <span>{ensName}</span>
	} else if (recipient) {
		const head = recipient.address.slice(0, 6)
		const tail = recipient.address.slice(-4)
		return (
			<span>
				{head}…{tail}
			</span>
		)
	} else {
		return null
	}
}
