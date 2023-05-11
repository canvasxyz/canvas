import React from "react"

export const IconButton = ({ icon, onClick, disabled }: { onClick: () => void; icon: any; disabled: boolean }) => (
	<div
		className={`shrink border rounded ${
			disabled
				? "bg-gray-200 hover:cursor-not-allowed"
				: "bg-gray-50 border-gray-400 drop-shadow-md hover:drop-shadow active:drop-shadow-sm hover:cursor-pointer hover:border-gray-300 hover:bg-gray-100"
		}`}
		onClick={disabled ? () => {} : onClick}
	>
		{icon({ className: disabled ? "stroke-gray-500" : "stroke-black", width: "36px" })}
	</div>
)
