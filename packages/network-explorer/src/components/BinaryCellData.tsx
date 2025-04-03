import * as cbor from "@ipld/dag-cbor"
import * as json from "@ipld/dag-json"
import { Text, IconButton, Popover } from "@radix-ui/themes"
import { CellContext } from "@tanstack/react-table"
import { useMemo } from "react"
import { LuBinary } from "react-icons/lu"

export function BinaryCellData(cellContext: CellContext<any, unknown>) {
	const encodedJsonData = useMemo(() => {
		if (cellContext.getValue() === undefined) {
			return "<undefined>"
		}
		try {
			return json.stringify(cbor.decode(cellContext.getValue() as Uint8Array))
		} catch (err) {
			return json.stringify(cellContext.getValue())
		}
	}, [cellContext.getValue()])

	return (
		<Popover.Root>
			<Popover.Trigger>
				<IconButton color="gray" radius="full" size="1">
					<LuBinary />
				</IconButton>
			</Popover.Trigger>
			<Popover.Content>
				<Text size="2">{encodedJsonData}</Text>
			</Popover.Content>
		</Popover.Root>
	)
}
