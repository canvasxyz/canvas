import React from "react"

export interface UserAddressProps {
	className?: string
	address: string
}

export const UserAddress: React.FC<UserAddressProps> = (props) => {
	const className = props.className ?? "text-sm"
	return (
		<code className={className}>
			{props.address.slice(0, 6)}…{props.address.slice(-4)}
		</code>
	)
}
