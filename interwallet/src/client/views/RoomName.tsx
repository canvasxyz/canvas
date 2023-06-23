import React, { useContext, useMemo } from "react"
import { useEnsName } from "wagmi"
import { getAddress } from "viem"

import { PublicUserRegistration, Room } from "../../shared/index.js"
import { ChatContext } from "./ChatContext.js"

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

export const RoomName = () => {
	const { user, selectedRoom } = useContext(ChatContext)

	const otherRoomMembers = useMemo(
		() => selectedRoom && selectedRoom.members.filter(({ address }) => getAddress(address) !== user.address),
		[selectedRoom, user]
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
