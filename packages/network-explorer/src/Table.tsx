import useSWR from "swr"
import { Box, Button, Checkbox, Flex, Text } from "@radix-ui/themes"
import { TableToolbar } from "./TableToolbar.js"
import { LuChevronDown, LuChevronsUpDown, LuChevronUp } from "react-icons/lu"
import {
	ColumnDef,
	ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	SortingState,
	useReactTable,
} from "@tanstack/react-table"
import { useState } from "react"
import { fetchAndIpldParseJson } from "./utils.js"

export type Column = {
	name: string
	type: "string" | "number"
}

export const Table = <T,>({ tableName, defaultColumns }: { tableName: string; defaultColumns: ColumnDef<T>[] }) => {
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]) // can set initial column filter state here

	const [sorting, setSorting] = useState<SortingState>([])

	const [entriesPerPage, setEntriesPerPage] = useState(20)
	const params: Record<string, string> = {
		limit: (entriesPerPage + 1).toString(),
	}

	// TODO: cursor pagination
	if (sorting.length === 1) {
		params.orderBy = JSON.stringify({
			[sorting[0].id]: sorting[0].desc ? "desc" : "asc",
		})
	}

	const { data, mutate: doRefresh } = useSWR(
		`/api/models/${tableName}?${new URLSearchParams(params).toString()}`,
		fetchAndIpldParseJson<T[]>,
		{
			refreshInterval: 1000,
		},
	)

	// const { data: countData } = useSWR(`/api/messages/count`, fetchAndIpldParseJson<{ count: number }>, {
	// 	refreshInterval: 1000,
	// })

	// const [columns] = useState<typeof defaultColumns>(defaultColumns)
	const [columnVisibility, setColumnVisibility] = useState({})

	const tanStackTable = useReactTable<T>({
		columns: defaultColumns,
		data: data ? data.content : [],
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		manualSorting: true,
		manualFiltering: true,
		// rowCount,
		state: {
			columnVisibility,
			sorting,
			columnFilters,
		},
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		onColumnFiltersChange: setColumnFilters,
	})

	return (
		<Flex direction="column" maxWidth="calc(100vw - 340px)" flexGrow="1">
			<TableToolbar
				tanStackTable={tanStackTable}
				entriesPerPage={entriesPerPage}
				setEntriesPerPage={setEntriesPerPage}
				responseTime={data ? data.responseTime : undefined}
				doRefresh={doRefresh}
				columnFilters={columnFilters}
				setColumnFilters={setColumnFilters}
			/>
			<Box overflowX="scroll">
				<table style={{ borderCollapse: "collapse", display: "grid" }}>
					<thead style={{ display: "grid", position: "sticky", top: 0, zIndex: 1, backgroundColor: "white" }}>
						{tanStackTable.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id} style={{ display: "flex", width: "100%" }}>
								<th
									style={{
										borderWidth: "1px",
										borderTopWidth: "0px",
										borderLeftWidth: "0px",
										borderColor: "var(--accent-3)",
										borderStyle: "solid",
										display: "flex",
									}}
								>
									<Flex align="center" p="1">
										<Checkbox color="gray" />
									</Flex>
								</th>
								{headerGroup.headers.map((header) => (
									<th
										key={header.id}
										style={{
											display: "flex",
											width: header.getSize(),
											borderWidth: "1px",
											borderTopWidth: "0px",
											borderLeftWidth: "0px",
											borderColor: "var(--accent-3)",
											borderStyle: "solid",
										}}
									>
										<Flex width="100%" gap="2" p="1">
											<Text weight="medium">
												{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
											</Text>
											{header.column.getCanSort() && (
												<Flex ml="auto" align="center">
													<Button
														variant="soft"
														color="gray"
														size="1"
														style={{ padding: "4px" }}
														onClick={header.column.getToggleSortingHandler()}
													>
														{header.column.getIsSorted() === "asc" ? (
															<LuChevronUp style={{ fontSize: "var(--font-size-3)" }} />
														) : header.column.getIsSorted() === "desc" ? (
															<LuChevronDown style={{ fontSize: "var(--font-size-3)" }} />
														) : (
															<LuChevronsUpDown style={{ fontSize: "var(--font-size-3)" }} />
														)}
													</Button>
												</Flex>
											)}
										</Flex>
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody
						style={{
							display: "grid",
							overflowY: "scroll",
							scrollbarWidth: "none",
							position: "relative",
						}}
					>
						{tanStackTable.getRowModel().rows.map((row) => (
							<tr key={row.id} style={{ display: "flex" }}>
								<td
									style={{
										borderWidth: "1px",
										borderTopWidth: "0px",
										borderLeftWidth: "0px",
										borderColor: "var(--accent-3)",
										borderStyle: "solid",
										display: "flex",
									}}
								>
									<Flex align="center" p="1">
										<Checkbox color="gray" />
									</Flex>
								</td>
								{row.getVisibleCells().map((cell) => (
									<td
										key={cell.id}
										style={{
											borderWidth: "1px",
											borderTopWidth: "0px",
											borderLeftWidth: "0px",
											borderColor: "var(--accent-3)",
											borderStyle: "solid",
											display: "flex",
											width: cell.column.getSize(),
										}}
									>
										<Flex gap="2" p="1">
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</Flex>
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</Box>
		</Flex>
	)
}
