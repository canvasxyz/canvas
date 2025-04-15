import { Button, DropdownMenu } from "@radix-ui/themes"
import { LuSlidersHorizontal } from "react-icons/lu"
import { Table } from "@tanstack/react-table"
import { ClickableChecklistItem } from "../ClickableChecklistItem.js"

export const ColumnsDropdown = ({ tanStackTable }: { tanStackTable: Table<any> }) => (
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			<Button color="gray" variant="outline">
				<LuSlidersHorizontal />
				Columns
			</Button>
		</DropdownMenu.Trigger>
		<DropdownMenu.Content>
			{" "}
			{tanStackTable.getAllLeafColumns().map((column) => (
				<ClickableChecklistItem
					key={column.id}
					checked={column.getIsVisible()}
					onCheckedChange={column.toggleVisibility}
				>
					{column.columnDef.header?.toString()}
				</ClickableChecklistItem>
			))}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
)
