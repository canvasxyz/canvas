import { Box, Button, DropdownMenu, Flex, Text, TextField } from "@radix-ui/themes"
import { ColumnFiltersState, OnChangeFn, Table as TanStackTable } from "@tanstack/react-table"
import { BiChevronLeft, BiChevronRight, BiFilter, BiSidebar } from "react-icons/bi"
// import { FaClockRotateLeft } from "react-icons/fa6"
import { /*LuDownload,*/ LuRefreshCw, LuSlidersHorizontal } from "react-icons/lu"
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
}) => {
	return (
		<Flex style={{ borderBottom: "1px solid var(--gray-3)" }} align="center" gap="2" p="2">
			<Button color="gray" variant={showSidebar ? "outline" : "solid"} onClick={() => setShowSidebar(!showSidebar)}>
				<BiSidebar />
			</Button>

			{/* <Flex>
				<Button
					color="gray"
					variant="outline"
					style={{
						boxShadow: "none",
						borderTop: "1px solid var(--accent-a8)",
						borderBottom: "1px solid var(--accent-a8)",
						borderLeft: "1px solid var(--accent-a8)",
						borderTopRightRadius: "0px",
						borderBottomRightRadius: "0px",
					}}
				>
					<BiChevronLeft />
				</Button>
				<Button
					color="gray"
					variant="outline"
					style={{
						boxShadow: "none",
						border: "1px solid var(--accent-a8)",
						borderTopLeftRadius: "0px",
						borderBottomLeftRadius: "0px",
					}}
				>
					<BiChevronRight />
				</Button>
			</Flex> */}

			{/* <Button color="gray" variant="outline">
				<FaClockRotateLeft />
			</Button> */}

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
					{/* {tanStackTable.getFilter} */}
					{/* {tanStackTable.getAllLeafColumns().map((column) => (
						<ClickableChecklistItem
							key={column.id}
							checked={column.getIsVisible()}
							onCheckedChange={column.toggleVisibility}
						>
							{column.columnDef.header?.toString()}
						</ClickableChecklistItem>
					))} */}
				</DropdownMenu.Content>
			</DropdownMenu.Root>

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

			{/* <Button color="gray" variant="outline">
				Add record
			</Button> */}

			<Box ml="auto">
				<Text>
					{totalCount || "-"} rows &bull; {responseTime ? `${responseTime}ms` : "-"}
				</Text>
			</Box>

			<Flex>
				<Button color="gray" variant="outline" style={{ borderTopRightRadius: "0px", borderBottomRightRadius: "0px" }}>
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
				{/* TODO: display page offset? */}
				{/* <TextField.Root
					value={}
					style={{ borderRadius: "0px", width: "40px" }}
				/> */}
				<Button color="gray" variant="outline" style={{ borderTopLeftRadius: "0px", borderBottomLeftRadius: "0px" }}>
					<BiChevronRight />
				</Button>
			</Flex>

			<Button color="gray" variant="outline" onClick={() => doRefresh()}>
				<LuRefreshCw />
			</Button>

			{/* <Button color="gray" variant="outline">
				<LuDownload />
			</Button> */}
		</Flex>
	)
}
