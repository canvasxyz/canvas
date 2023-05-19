import React from "react"

export interface IconButtonProps {
	onClick: () => void
	icon: any
	disabled?: boolean
}

export const IconButton = (props: IconButtonProps) => (
	<div
		className={`shrink border rounded ${
			props.disabled
				? "bg-gray-200 hover:cursor-not-allowed"
				: "bg-gray-50 border-gray-400 drop-shadow-md hover:drop-shadow active:drop-shadow-sm hover:cursor-pointer hover:border-gray-300 hover:bg-gray-100"
		}`}
		onClick={props.disabled ? () => {} : props.onClick}
	>
		{props.icon({ className: props.disabled ? "stroke-gray-500" : "stroke-black", width: "36px", height: "36px" })}
	</div>
)
