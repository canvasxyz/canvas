import useSWR from "swr"
import { Box, Button, Flex, Text } from "@radix-ui/themes"
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
import { useEffect, useState } from "react"
import { fetchAndIpldParseJson } from "../utils.js"
import useCursorStack from "../hooks/useCursorStack.js"
import { WhereCondition } from "@canvas-js/modeldb"

export type Column = {
	name: string
	type: "string" | "number"
}

type SortDirection = "desc" | "asc"

type RequestParams = {
	limit: number
	orderBy: {
		[sortColumn: string]: SortDirection
	}
	where: WhereCondition
}

const stringifyRequestParams = ({ limit, orderBy, where }: RequestParams) => {
	const params: Record<string, string> = {
		limit: limit.toString(),
		orderBy: JSON.stringify(orderBy),
	}
	if (Object.keys(where).length > 0) {
		params.where = JSON.stringify(where)
	}
	return new URLSearchParams(params).toString()
}

export const Table = <T,>({
	showSidebar,
	setShowSidebar,
	tableName,
	defaultColumns,
	defaultSortColumn,
	defaultSortDirection,
}: {
	showSidebar: boolean
	setShowSidebar: (show: boolean) => void
	tableName: string
	defaultColumns: ColumnDef<T>[]
	defaultSortColumn: string
	defaultSortDirection: "desc" | "asc"
}) => {
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]) // can set initial column filter state here

	const { clearCursors, currentCursor, popCursor, pushCursor } = useCursorStack()

	const [sorting, setSorting] = useState<SortingState>([])

	const [entriesPerPage, setEntriesPerPage] = useState(20)

	const sortColumn = sorting.length === 1 ? sorting[0].id : defaultSortColumn
	const sortDirection = sorting.length === 1 ? (sorting[0].desc ? "desc" : "asc") : defaultSortDirection

	const where: WhereCondition = {}
	if (currentCursor) {
		where[sortColumn] = {
			[sortDirection === "desc" ? "lt" : "gt"]: currentCursor,
		}
	}

	const { data, mutate: doRefresh } = useSWR(
		`/api/models/${tableName}?${stringifyRequestParams({
			limit: entriesPerPage + 1,
			orderBy: {
				[sortColumn]: sortDirection,
			},
			where,
		})}`,
		fetchAndIpldParseJson<{ totalCount: number; results: T[] }>,
		{
			refreshInterval: 1000,
		},
	)

	const [columnVisibility, setColumnVisibility] = useState({})

	const rows = data ? data.content.results : []

	const endCursor = rows.length > entriesPerPage ? (rows[rows.length - 1] as any)[sortColumn] : null

	const tanStackTable = useReactTable<T>({
		columns: defaultColumns,
		data: rows,
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		manualSorting: true,
		manualFiltering: true,
		state: {
			columnVisibility,
			sorting,
			columnFilters,
		},
		onSortingChange: (sortingState) => {
			setSorting(sortingState)
			// reset pagination when sorting changes
			clearCursors()
		},
		onColumnVisibilityChange: setColumnVisibility,
		onColumnFiltersChange: (columnFilters) => {
			setColumnFilters(columnFilters)
			// reset pagination when filters change
			clearCursors()
		},
	})

	useEffect(() => {
		// invalidate the settings
		setColumnVisibility({})
		setSorting([])
		setColumnFilters([])
		clearCursors()
	}, [tableName])

	return (
		<Flex direction="column" maxWidth="calc(100vw - 340px)" flexGrow="1">
			<TableToolbar
				totalCount={data?.content.totalCount}
				showSidebar={showSidebar}
				setShowSidebar={setShowSidebar}
				tanStackTable={tanStackTable}
				entriesPerPage={entriesPerPage}
				setEntriesPerPage={setEntriesPerPage}
				responseTime={data ? data.responseTime : undefined}
				doRefresh={doRefresh}
				columnFilters={columnFilters}
				setColumnFilters={setColumnFilters}
				hasPrevPage={currentCursor !== null}
				prevPage={() => popCursor()}
				hasNextPage={endCursor !== null}
				nextPage={() => pushCursor(endCursor)}
			/>
			<Box overflowX="scroll">
				<table style={{ borderCollapse: "collapse", display: "grid" }}>
					<thead style={{ display: "grid", position: "sticky", top: 0, zIndex: 1, backgroundColor: "white" }}>
						{tanStackTable.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id} style={{ display: "flex", width: "100%" }}>
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
							<tr key={row.id} style={{ display: "flex", overflow: "hidden", scrollbarWidth: "none" }}>
								{row.getVisibleCells().map((cell) => (
									<td
										key={cell.id}
										style={{
											overflowX: "scroll",
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
