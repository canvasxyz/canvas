import { Flex } from "@radix-ui/themes"
import { CellContext } from "@tanstack/react-table"

export const EditableTextCell = ({
	value,
	setValue,
}: {
	value: string
	setValue: (value: string) => void
} & CellContext<any, unknown>) => {
	return (
		<Flex>
			<input type="text" value={value} onChange={(e) => setValue(e.target.value)}></input>
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
	return (
		<Flex>
			<input type="number" value={value} onChange={(e) => setValue(parseInt(e.target.value))}></input>
		</Flex>
	)
}
