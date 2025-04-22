import { Flex } from "@radix-ui/themes"
import { CellContext } from "@tanstack/react-table"

export const EditableCell = ({
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
