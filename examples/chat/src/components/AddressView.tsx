import React from "react"

export interface AddressViewProps {
	className?: string
	address: string
}

export const AddressView: React.FC<AddressViewProps> = (props) => {
	const className = props.className ?? "text-sm"
	return (
		<code className={className}>
			{/* {props.address.slice(0, 6)}…{props.address.slice(-4)} */}
			{props.address}
		</code>
	)
}
