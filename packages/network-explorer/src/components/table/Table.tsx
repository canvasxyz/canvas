import useSWR from "swr"
import { WhereCondition } from "@canvas-js/modeldb"
import { List as ImmutableList, Set as ImmutableSet } from "immutable"
import { Box, Button, DropdownMenu, Flex, Text, TextField } from "@radix-ui/themes"
import { useCallback, useEffect, useState } from "react"
import { BiChevronLeft, BiChevronRight } from "react-icons/bi"
import {
	LuChevronDown,
	LuChevronsUpDown,
	LuChevronUp,
	LuDownload,
	LuExpand,
	LuRefreshCw,
	LuSlidersHorizontal,
} from "react-icons/lu"
import { ColumnDef, flexRender, getCoreRowModel, Row, SortingState, useReactTable } from "@tanstack/react-table"
import useCursorStack from "../../hooks/useCursorStack.js"
import { useApplicationData } from "../../hooks/useApplicationData.js"
import { useSearchFilters } from "../../hooks/useSearchFilters.js"
import { useStagedMigrations } from "../../hooks/useStagedMigrations.js"
import { fetchAndIpldParseJson, fetchAsString } from "../../utils.js"
import { TableElement, Tbody, Th, Thead, TheadSpacer, NoneFound, ThCheckbox, Td } from "./elements.js"
import { ClickableChecklistItem } from "../ClickableChecklistItem.js"
import { FiltersDropdown } from "./FiltersDropdown.js"

export type Column = {
	name: string
	type: "string" | "number"
}

type SortDirection = "desc" | "asc"

type RequestParams = {
	limit: number
	orderBy?: {
		[sortColumn: string]: SortDirection
	}
	where?: WhereCondition
}

export const stringifyRequestParams = ({ limit, orderBy, where }: RequestParams) => {
	const params: Record<string, string> = {}
	if (limit) {
		params.limit = limit.toString()
	}
	if (orderBy) {
		params.orderBy = JSON.stringify(orderBy)
	}
	if (where && Object.keys(where).length > 0) {
		params.where = JSON.stringify(where)
	}
	return new URLSearchParams(params).toString()
}

export const Table = <T,>({
	showSidebar,
	setShowSidebar,
	tableName,
	enableDownload,
	defaultColumns,
	defaultSortColumn,
	defaultSortDirection,
	allowDelete,
	getRowKey,
}: {
	showSidebar: boolean
	setShowSidebar: (show: boolean) => void
	tableName: string
	enableDownload: boolean
	defaultColumns: ColumnDef<T>[]
	defaultSortColumn: string
	defaultSortDirection: "desc" | "asc"
	allowDelete: boolean
	getRowKey: (row: Row<T>) => string[]
}) => {
	const applicationData = useApplicationData()
	const { stageDeleteRows } = useStagedMigrations()
	const [columnFilters, setColumnFilters] = useSearchFilters(
		defaultColumns.filter((col) => col.enableColumnFilter).map((col) => col.header as string),
	)

	const { clearCursors, currentCursor, popCursor, pushCursor } = useCursorStack()

	const [sorting, setSorting] = useState<SortingState>([])

	const [entriesPerPage, setEntriesPerPage] = useState(20)

	const [selectedRows, setSelectedRows] = useState<ImmutableSet<ImmutableList<string>>>(ImmutableSet.of())

	const sortColumn = sorting.length === 1 ? sorting[0].id : defaultSortColumn
	const sortDirection = sorting.length === 1 ? (sorting[0].desc ? "desc" : "asc") : defaultSortDirection

	const where: WhereCondition = {}
	if (currentCursor) {
		where[sortColumn] = {
			[sortDirection === "desc" ? "lt" : "gt"]: currentCursor,
		}
	}

	for (const f of columnFilters) {
		where[f.id] = f.value as string | number
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

	let rows: T[] | undefined = undefined
	let endCursor: any
	if (data) {
		rows = data.content.results
		endCursor = (rows?.length || 0) > entriesPerPage ? (rows[rows.length - 1] as any)[sortColumn] : null
	}

	const [columnVisibility, setColumnVisibility] = useState({})

	const tanStackTable = useReactTable<T>({
		columns: defaultColumns,
		data: rows || [],
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

	const deleteSelectedRows = useCallback(() => {
		if (selectedRows.size === 0) {
			return
		}

		stageDeleteRows(tableName, selectedRows.map((row) => row.toArray()).toArray())

		// clear the selected rows
		setSelectedRows(ImmutableSet.of())
	}, [tableName, selectedRows, setSelectedRows, stageDeleteRows])

	useEffect(() => {
		// invalidate the settings
		setColumnVisibility({})
		setSorting([])
		setColumnFilters([])
		clearCursors()
	}, [tableName])

	const downloadTable = useCallback(async () => {
		if (!applicationData?.topic) {
			return
		}
		const content = await fetchAsString(`/api/models/${tableName}`)
		const element = document.createElement("a")
		const file = new Blob([content], { type: "text/plain" })
		element.href = URL.createObjectURL(file)
		element.download = `${applicationData?.topic}-${tableName.replace("$", "")}.json`
		document.body.appendChild(element) // Required for this to work in FireFox
		element.click()
	}, [applicationData?.topic])

	const tableHasFilters = tanStackTable.getAllLeafColumns().filter((column) => column.getCanFilter()).length > 0

	return (
		<Flex direction="column" maxWidth={showSidebar ? "calc(100vw - 200px - 400px)" : "100%"} flexGrow="1">
			<Flex style={{ borderBottom: "1px solid var(--gray-3)" }} align="center" gap="2" p="2" py="3">
				{tableHasFilters && (
					<FiltersDropdown
						tanStackTable={tanStackTable}
						columnFilters={columnFilters}
						setColumnFilters={setColumnFilters}
					/>
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
				<Button
					disabled={!allowDelete || selectedRows.size === 0}
					onClick={() => deleteSelectedRows()}
					color="gray"
					variant="outline"
				>
					Delete
				</Button>

				<Box ml="auto" pr="2">
					<Text size="2" wrap="nowrap">
						{data?.content.totalCount || "0"} rows {data ? <>&bull; {`${data.responseTime}ms`}</> : ""}
					</Text>
				</Box>

				<Flex>
					<Button
						disabled={currentCursor === null}
						onClick={() => popCursor()}
						color="gray"
						variant="outline"
						style={{ borderTopRightRadius: "0px", borderBottomRightRadius: "0px" }}
					>
						<BiChevronLeft />
					</Button>
					<TextField.Root
						value={entriesPerPage}
						onChange={(e) => {
							const value = parseInt(e.target.value, 10)
							if (isNaN(value)) return
							if (value === 0) {
								setEntriesPerPage(10)
							} else {
								setEntriesPerPage(value)
							}
						}}
						color="gray"
						style={{
							borderRadius: "0px",
							width: "44px",
							boxShadow: "none",
							borderTop: "1px solid var(--accent-a8)",
							borderBottom: "1px solid var(--accent-a8)",
							textAlign: "center",
							paddingRight: "8px",
						}}
					/>
					<Button
						disabled={endCursor === null}
						onClick={() => pushCursor(endCursor)}
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
				{enableDownload && (
					<Button color="gray" variant="outline" onClick={() => downloadTable()}>
						<LuDownload />
					</Button>
				)}
				<Button color="gray" variant={showSidebar ? "outline" : "solid"} onClick={() => setShowSidebar(!showSidebar)}>
					<LuExpand />
				</Button>
			</Flex>
			<Box overflowX="scroll" flexGrow="1">
				<Text size="2">
					<TableElement>
						<Thead>
							{tanStackTable.getHeaderGroups().map((headerGroup) => (
								<tr key={headerGroup.id} style={{ display: "flex", width: "100%" }}>
									{allowDelete && <TheadSpacer />}
									{headerGroup.headers.map((header) => (
										<Th key={header.id} width={header.getSize()}>
											<Flex width="100%" gap="2" p="1">
												<Text weight="medium">
													{header.isPlaceholder
														? null
														: flexRender(header.column.columnDef.header, header.getContext())}
												</Text>
												{header.column.getCanSort() && (
													<Flex ml="auto" align="center">
														<Button
															variant="soft"
															color="gray"
															size="1"
															style={{ padding: "4px", position: "relative", top: "-1px" }}
															onClick={header.column.getToggleSortingHandler()}
														>
															{header.column.getIsSorted() === "asc" ? (
																<LuChevronUp style={{ fontSize: "var(--font-size-3)" }} />
															) : header.column.getIsSorted() === "desc" ? (
																<LuChevronDown style={{ fontSize: "var(--font-size-3)" }} />
															) : (
																<LuChevronsUpDown style={{ fontSize: "var(--font-size-3)", color: "var(--gray-8)" }} />
															)}
														</Button>
													</Flex>
												)}
											</Flex>
										</Th>
									))}
								</tr>
							))}
						</Thead>
						<Tbody>
							{tanStackTable.getRowCount() === 0 && <NoneFound />}
							{tanStackTable.getRowModel().rows.map((row) => (
								<tr key={row.id} style={{ display: "flex", overflow: "hidden", scrollbarWidth: "none" }}>
									{allowDelete && (
										<ThCheckbox
											checked={selectedRows.has(ImmutableList.of(...getRowKey(row)))}
											onCheckedChange={(checked) => {
												const rowKey = ImmutableList.of(...getRowKey(row))
												setSelectedRows(checked ? selectedRows.add(rowKey) : selectedRows.delete(rowKey))
											}}
										/>
									)}
									{row.getVisibleCells().map((cell) => (
										<Td key={cell.id} width={cell.column.getSize()}>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</Td>
									))}
								</tr>
							))}
						</Tbody>
					</TableElement>
				</Text>
			</Box>
		</Flex>
	)
}
