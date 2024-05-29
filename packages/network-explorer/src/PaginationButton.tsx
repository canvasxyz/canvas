function PaginationButton({ text, onClick, enabled }: { text: string; enabled: boolean; onClick: () => void }) {
	const className = enabled
		? "p-2 border rounded-lg cursor-pointer select-none"
		: "p-2 border rounded-lg bg-gray-100 cursor-not-allowed select-none"

	return (
		<div
			className={className}
			onClick={(e) => {
				if (!enabled) return
				onClick()
			}}
		>
			{text}
		</div>
	)
}

export default PaginationButton
