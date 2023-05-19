import React, { useCallback } from "react"

import { PeerId } from "@libp2p/interface-peer-id"

import copyIcon from "../icons/copy.svg"

export interface PeerIdTokenProps {
	peerId: PeerId
	className?: string
	children?: React.ReactNode
}

export const PeerIdToken: React.FC<PeerIdTokenProps> = (props) => {
	const id = props.peerId.toString()

	const classNames = ["inline-flex items-center bg-gray-100 hover:cursor-pointer hover:bg-gray-200 active:bg-gray-300"]
	if (props.className) {
		classNames.push(props.className)
	}

	const handleClick = useCallback(() => {
		navigator.clipboard.writeText(id)
	}, [id])

	return (
		<button className={classNames.join(" ")} onClick={handleClick}>
			{props.children}
			<span className="whitespace-pre">…{id.slice(-6)}</span>
			{copyIcon({ width: 24, height: 24 })}
		</button>
	)
}
