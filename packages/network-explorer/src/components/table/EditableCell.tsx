import { Flex } from "@radix-ui/themes"
import { CellContext } from "@tanstack/react-table"
import { useState } from "react"

const inputStyle = {
	position: "relative" as const,
	top: "-2px",
	width: "100%",
	background: "transparent",
	outline: "none",
	border: "none",
	fontSize: "14px",
}

const inputFocusStyle = {
	...inputStyle,
	borderRadius: "2px",
	boxShadow: "0 0 0 1px var(--accent-7)",
}

export const EditableTextCell = ({
	value,
	setValue,
}: {
	value: string
	setValue: (value: string) => void
} & CellContext<any, unknown>) => {
	const [isFocused, setIsFocused] = useState(false)

	return (
		<Flex flexGrow="1">
			<input
				style={isFocused ? inputFocusStyle : inputStyle}
				type="text"
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onFocus={() => setIsFocused(true)}
				onBlur={() => setIsFocused(false)}
			/>
		</Flex>
	)
}

export const EditableIntegerCell = ({
	value,
	setValue,
}: {
	value: number
	setValue: (value: number) => void
} & CellContext<any, unknown>) => {
	const [isFocused, setIsFocused] = useState(false)

	return (
		<Flex flexGrow="1">
			<input
				style={isFocused ? inputFocusStyle : inputStyle}
				type="number"
				value={value}
				onChange={(e) => setValue(parseInt(e.target.value))}
				onFocus={() => setIsFocused(true)}
				onBlur={() => setIsFocused(false)}
			/>
		</Flex>
	)
}
