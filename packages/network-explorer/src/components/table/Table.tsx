import useSWR from "swr"
import { ModelValue, WhereCondition } from "@canvas-js/modeldb"
import { Map as ImmutableMap, Set as ImmutableSet, List as ImmutableList } from "immutable"
import { Box, Button, Flex, Text } from "@radix-ui/themes"
import { useCallback, useEffect, useState } from "react"
import { LuDownload, LuExpand, LuRefreshCw } from "react-icons/lu"
import { ColumnDef, flexRender, getCoreRowModel, Row, SortingState, useReactTable } from "@tanstack/react-table"
import useCursorStack from "../../hooks/useCursorStack.js"
import { useApplicationData } from "../../hooks/useApplicationData.js"
import { useSearchFilters } from "../../hooks/useSearchFilters.js"
import { useStagedMigrations } from "../../hooks/useStagedMigrations.js"
import { fetchAndIpldParseJson, fetchAsString } from "../../utils.js"
import { TableElement, Tbody, Th, Thead, TheadSpacer, NoneFound } from "./elements.js"
import { FiltersDropdown } from "./FiltersDropdown.js"
import { ColumnsDropdown } from "./ColumnsDropdown.js"
import { PaginationControl } from "./PaginationControl.js"
import { SortSelector } from "./SortSelector.js"
import { decodeRowKey, encodeRowKey, ImmutableRowKey } from "../../hooks/useChangedRows.js"
import { usePageTitle } from "../../hooks/usePageTitle.js"
import { EditableRow, NonEditableRow } from "./EditableRow.js"

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
	allowEditing,
	getRowKey,
}: {
	showSidebar: boolean
	setShowSidebar: (show: boolean) => void
	tableName: string
	enableDownload: boolean
	defaultColumns: ColumnDef<T>[]
	defaultSortColumn: string
	defaultSortDirection: "desc" | "asc"
	allowEditing: boolean
	getRowKey: (row: Row<T>) => string[]
}) => {
	usePageTitle(`${tableName} | Application Explorer`)
	const applicationData = useApplicationData()
	const { stageRowChange, changedRows, newRows, setNewRows } = useStagedMigrations()
	const [columnFilters, setColumnFilters] = useSearchFilters(
		defaultColumns.filter((col) => col.enableColumnFilter).map((col) => col.header as string),
	)

	const { clearCursors, currentCursor, popCursor, pushCursor } = useCursorStack()

	const [sorting, setSorting] = useState<SortingState>([])

	const defaultEntriesPerPage = 20
	const [entriesPerPage, setEntriesPerPage] = useState(defaultEntriesPerPage)

	const [selectedRows, setSelectedRows] = useState<ImmutableSet<ImmutableRowKey>>(ImmutableSet.of())

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

		for (const row of selectedRows.toArray()) {
			stageRowChange(tableName, decodeRowKey(row), {
				type: "delete",
			})
		}

		// clear the selected rows
		setSelectedRows(ImmutableSet.of())
	}, [tableName, selectedRows, setSelectedRows, stageRowChange])

	useEffect(() => {
		// invalidate the settings
		setColumnVisibility({})
		setSorting([])
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

	const tableChangedRows = changedRows.get(tableName) || ImmutableMap()

	const tableNewRows = newRows.get(tableName) || ImmutableList.of()

	const newRowsTable = useReactTable<ModelValue>({
		columns: defaultColumns as ColumnDef<ModelValue>[],
		data: tableNewRows.toArray(),
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		manualSorting: true,
		manualFiltering: true,
		state: {
			columnVisibility,
		},
		onColumnVisibilityChange: setColumnVisibility,
	})

	return (
		<Flex direction="column" maxWidth={showSidebar ? "calc(100vw - 200px)" : "100%"} flexGrow="1">
			<Flex style={{ borderBottom: "1px solid var(--gray-3)" }} align="center" gap="2" p="2" py="3">
				{tableHasFilters && (
					<FiltersDropdown
						tanStackTable={tanStackTable}
						columnFilters={columnFilters}
						setColumnFilters={setColumnFilters}
					/>
				)}
				<ColumnsDropdown tanStackTable={tanStackTable} />
				<Button
					disabled={!allowEditing || selectedRows.size === 0}
					onClick={() => deleteSelectedRows()}
					color="gray"
					variant="outline"
				>
					Delete
				</Button>

				<Button
					disabled={!allowEditing}
					onClick={() => {
						// add a new row
						const tableRows = newRows.get(tableName) || ImmutableList.of()
						setNewRows(newRows.set(tableName, tableRows.push({})))
					}}
					color="gray"
					variant="outline"
				>
					New Entry
				</Button>

				<Box ml="auto" pr="2">
					<Text size="2" wrap="nowrap">
						{data?.content.totalCount || "0"} rows {data ? <>&bull; {`${data.responseTime}ms`}</> : ""}
					</Text>
				</Box>

				<PaginationControl
					defaultEntriesPerPage={defaultEntriesPerPage}
					entriesPerPage={entriesPerPage}
					setEntriesPerPage={setEntriesPerPage}
					canGoPrevious={currentCursor !== null}
					goPreviousPage={() => popCursor()}
					canGoNext={endCursor !== null}
					goNextPage={() => pushCursor(endCursor)}
				/>

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
			<Box overflowX="scroll" flexGrow="1" pb={(tableChangedRows.size > 0 || tableNewRows.size > 0) ? "60vh" : "0"}>
				<Text size="2">
					<TableElement>
						<Thead>
							{tanStackTable.getHeaderGroups().map((headerGroup) => (
								<tr key={headerGroup.id} style={{ display: "flex", width: "100%" }}>
									{allowEditing && <TheadSpacer />}
									{headerGroup.headers.map((header) => (
										<Th key={header.id} width={header.getSize()}>
											<Flex width="100%" gap="2" p="1">
												<Text weight="medium">
													{header.isPlaceholder
														? null
														: flexRender(header.column.columnDef.header, header.getContext())}
												</Text>
												{header.column.getCanSort() && <SortSelector header={header} />}
											</Flex>
										</Th>
									))}
								</tr>
							))}
						</Thead>
						<Tbody>
							{tanStackTable.getRowCount() === 0 && <NoneFound />}
							{tanStackTable.getRowModel().rows.map((row) => {
								if (allowEditing) {
									const rowKey = getRowKey(row)
									const encodedRowKey = encodeRowKey(rowKey)
									const rowChange = tableChangedRows.get(encodedRowKey)

									let stagedValues: ModelValue | undefined = undefined
									if (rowChange && rowChange.type === "update") {
										stagedValues = rowChange.value
									}
									return (
										<EditableRow
											key={row.id}
											row={row}
											stagedValues={stagedValues}
											setStagedValues={(newValues) => {
												stageRowChange(tableName, rowKey, {
													type: "update",
													value: newValues,
												})
											}}
											isStagedDelete={rowChange?.type === "delete"}
											checked={selectedRows.has(encodedRowKey)}
											onCheckedChange={(checked) => {
												setSelectedRows(checked ? selectedRows.add(encodedRowKey) : selectedRows.delete(encodedRowKey))
											}}
										/>
									)
								} else {
									return <NonEditableRow key={row.id} row={row} />
								}
							})}
							{newRowsTable.getRowModel().rows.map((row, index) => {
								return (
									<EditableRow
										key={row.id}
										row={row}
										stagedValues={row.original as ModelValue}
										setStagedValues={(newValues) => {
											// update new row with index
											const tableRows = newRows.get(tableName) || ImmutableList.of()
											const newTableRows = tableRows.set(index, newValues)
											setNewRows(newRows.set(tableName, newTableRows))
										}}
										isStagedDelete={false}
										isNewRow={true}
										checked={false}
										onCheckedChange={() => {}}
									/>
								)
							})}
						</Tbody>
					</TableElement>
				</Text>
			</Box>
		</Flex>
	)
}
