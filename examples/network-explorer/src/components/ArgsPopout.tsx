import { useState } from "react"

type ArgsPopoutProps = {
	data: string
}

function ArgsPopout({ data }: ArgsPopoutProps) {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<div
			className="inline-block cursor-pointer bg-[#d8d8d8] hover:bg-[#eeeeee] rounded-lg h-5 p-1 w-5"
			onClick={() => {
				setIsOpen(!isOpen)
			}}
		>
			{isOpen ? (
				<div className="absolute bg-white p-2 rounded-lg border">{data}</div>
			) : (
				<div className="-mt-1">...</div>
			)}
		</div>
	)
}

export default ArgsPopout
