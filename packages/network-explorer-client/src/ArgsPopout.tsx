import { useState } from "react"

type ArgsPopoutProps = {
	data: string
}

function ArgsPopout({ data }: ArgsPopoutProps) {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<div className="cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
			{isOpen ? <div>{data}</div> : "..."}
		</div>
	)
}

export default ArgsPopout
