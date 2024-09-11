import { Button } from "@radix-ui/themes"
import { useState } from "react"

type ArgsPopoutProps = {
	data: string
	placeholder?: string
}

function ArgsPopout({ data, placeholder }: ArgsPopoutProps) {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<Button
			color="gray"
			size="1"
			onClick={() => {
				setIsOpen(!isOpen)
			}}
		>
			{isOpen ? (
				<div className="absolute bg-white p-2 rounded-lg border">{data}</div>
			) : (
				<div className="-mt-1">{placeholder || "..."}</div>
			)}
		</Button>
	)
}

export default ArgsPopout
