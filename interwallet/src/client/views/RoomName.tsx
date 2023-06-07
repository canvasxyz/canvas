import React, { useContext, useMemo } from "react"
import { useEnsName } from "wagmi"
import { getAddress } from "viem"

import { Room } from "../../shared/index.js"

import { AppContext } from "../context.js"

export interface RoomNameProps {
	room: Room
}

export const RoomName: React.FC<RoomNameProps> = ({ room }) => {
	if (room.members.length !== 2) {
		throw new Error("rooms must have exactly two members")
	}

	const { user } = useContext(AppContext)

	const recipient = useMemo(
		() => user && room.members.find(({ address }) => getAddress(address) !== user.address),
		[room, user]
	)
	const { data: name } = useEnsName({ address: recipient?.address ?? undefined })

	if (name) {
		return <span>{name}</span>
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
