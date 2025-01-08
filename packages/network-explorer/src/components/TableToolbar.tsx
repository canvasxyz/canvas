import { Box, Button, DropdownMenu, Flex, Text, TextField } from "@radix-ui/themes"
import { ColumnFiltersState, OnChangeFn, Table as TanStackTable } from "@tanstack/react-table"
import { BiChevronLeft, BiChevronRight, BiFilter, BiSidebar } from "react-icons/bi"
import { LuRefreshCw, LuSlidersHorizontal } from "react-icons/lu"
import { ClickableChecklistItem } from "./ClickableChecklistItem.js"

export const TableToolbar = ({
	totalCount,
	showSidebar,
	setShowSidebar,
	tanStackTable,
	doRefresh,
	responseTime,
	entriesPerPage,
	setEntriesPerPage,
	columnFilters,
	setColumnFilters,
	hasPrevPage,
	prevPage,
	hasNextPage,
	nextPage,
}: {
	totalCount?: number
	showSidebar: boolean
	setShowSidebar: (show: boolean) => void
	tanStackTable: TanStackTable<any>
	doRefresh: () => void
	responseTime?: number
	entriesPerPage: number
	setEntriesPerPage: (entriesPerPage: number) => void
	columnFilters?: ColumnFiltersState
	setColumnFilters?: OnChangeFn<ColumnFiltersState>
	hasPrevPage: boolean
	prevPage: () => void
	hasNextPage: boolean
	nextPage: () => void
}) => {
	const tableHasFilters = tanStackTable.getAllLeafColumns().filter((column) => column.getCanFilter()).length > 0

	return (
		<Flex style={{ borderBottom: "1px solid var(--gray-3)" }} align="center" gap="2" p="2">
			<Button color="gray" variant={showSidebar ? "outline" : "solid"} onClick={() => setShowSidebar(!showSidebar)}>
				<BiSidebar />
			</Button>

			{tableHasFilters && (
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						<Button color="gray" variant="outline">
							<BiFilter />
							Filters
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
										{(column.columnDef.meta?.filterOptions || []).map((filterOption) => (
											<ClickableChecklistItem
												key={filterOption}
												checked={
													(columnFilters || []).filter((f) => f.id === column.id && f.value === filterOption).length > 0
												}
												onCheckedChange={(checked) => {
													if (checked) {
														if (setColumnFilters) {
															setColumnFilters((columnFilters || []).concat({ id: column.id, value: filterOption }))
														}
													} else {
														if (setColumnFilters) {
															setColumnFilters(
																(columnFilters || []).filter((f) => !(f.id === column.id && f.value === filterOption)),
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
			)}
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

			<Box ml="auto">
				<Text>
					{totalCount || "-"} rows &bull; {responseTime ? `${responseTime}ms` : "-"}
				</Text>
			</Box>

			<Flex>
				<Button
					disabled={!hasPrevPage}
					onClick={() => prevPage()}
					color="gray"
					variant="outline"
					style={{ borderTopRightRadius: "0px", borderBottomRightRadius: "0px" }}
				>
					<BiChevronLeft />
				</Button>
				<TextField.Root
					value={entriesPerPage}
					onChange={(e) => {
						setEntriesPerPage(Number(e.target.value))
					}}
					color="gray"
					style={{
						borderRadius: "0px",
						width: "40px",
						boxShadow: "none",
						borderTop: "1px solid var(--accent-a8)",
						borderBottom: "1px solid var(--accent-a8)",
					}}
				/>
				<Button
					disabled={!hasNextPage}
					onClick={() => nextPage()}
					color="gray"
					variant="outline"
					style={{ borderTopLeftRadius: "0px", borderBottomLeftRadius: "0px" }}
				>
					<BiChevronRight />
				</Button>
			</Flex>

			<Button color="gray" variant="outline" onClick={() => doRefresh()}>
				<LuRefreshCw />
			</Button>
		</Flex>
	)
}
