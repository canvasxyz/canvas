import React, { useContext, useMemo } from "react"
import { useEnsName } from "wagmi"
import { getAddress } from "viem"

import { Room } from "../../shared/index.js"

import { AppContext } from "../context.js"

export interface RoomNameProps {
	room: Room
}

const EnsName = ({ address }: { address: string }) => {
	const { data: name } = useEnsName({ address: address as `0x${string}` })

	if (name) {
		return <span>{name}</span>
	} else {
		const head = address.slice(0, 6)
		const tail = address.slice(-4)
		return (
			<span>
				{head}…{tail}
			</span>
		)
	}
}

export const RoomName: React.FC<RoomNameProps> = ({ room }) => {
	const { user } = useContext(AppContext)

	const otherRoomMembers = useMemo(
		() => user && room.members.filter(({ address }) => getAddress(address) !== user.address),
		[room, user]
	)

	if (otherRoomMembers) {
		return (
			<span>
				{otherRoomMembers.map((member, index) => (
					<React.Fragment key={member.address}>
						<EnsName address={member.address} />
						{index < otherRoomMembers.length - 1 && ", "}
					</React.Fragment>
				))}
			</span>
		)
	} else {
		return null
	}
}
