import { DropdownMenu, Button } from "@radix-ui/themes"
import { ClickableChecklistItem } from "../ClickableChecklistItem.js"
import { TextFilterMenu } from "../TextFilterMenu.js"
import { BiFilter } from "react-icons/bi"
import { ColumnFiltersState, Table, OnChangeFn } from "@tanstack/react-table"

export const FiltersDropdown = ({
	tanStackTable,
	columnFilters,
	setColumnFilters,
}: {
	tanStackTable: Table<any>
	columnFilters: ColumnFiltersState
	setColumnFilters: OnChangeFn<ColumnFiltersState>
}) => {
	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				<Button color="gray" variant="outline">
					<BiFilter />
					Filters {columnFilters && columnFilters.length > 0 && `(${columnFilters.length})`}
				</Button>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content>
				{tanStackTable
					.getAllLeafColumns()
					.filter((column) => column.getCanFilter())
					.map((column) => (
						<DropdownMenu.Sub key={column.id}>
							<DropdownMenu.SubTrigger>{column.columnDef.header?.toString()}</DropdownMenu.SubTrigger>
							<DropdownMenu.SubContent>
								{column.columnDef.meta?.textFilter && setColumnFilters && (
									<TextFilterMenu column={column} columnFilters={columnFilters} setColumnFilters={setColumnFilters} />
								)}

								{column.columnDef.meta?.filterOptions &&
									column.columnDef.meta?.filterOptions.map((filterOption) => (
										<ClickableChecklistItem
											key={filterOption}
											checked={columnFilters.filter((f) => f.id === column.id && f.value === filterOption).length > 0}
											onCheckedChange={(checked) => {
												if (checked) {
													if (setColumnFilters) {
														setColumnFilters(columnFilters.concat({ id: column.id, value: filterOption }))
													}
												} else {
													if (setColumnFilters) {
														setColumnFilters(
															columnFilters.filter((f) => !(f.id === column.id && f.value === filterOption)),
														)
													}
												}
											}}
										>
											{filterOption}
										</ClickableChecklistItem>
									))}
							</DropdownMenu.SubContent>
						</DropdownMenu.Sub>
					))}{" "}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	)
}
