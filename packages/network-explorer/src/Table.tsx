import { Box, Button, Checkbox, Flex, Text } from "@radix-ui/themes"
import { TableToolbar } from "./TableToolbar.js"
import { LuChevronsUpDown } from "react-icons/lu"
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { useState } from "react"

export type Column = {
	name: string
	type: "string" | "number"
}

export const Table = <T,>({
	data,
	rowCount,
	defaultColumns,
	responseTime,
	entriesPerPage,
	setEntriesPerPage,
	doRefresh,
}: {
	data: T[]
	rowCount: number
	defaultColumns: ColumnDef<T>[]
	responseTime?: number
	entriesPerPage: number
	setEntriesPerPage: (entriesPerPage: number) => void
	doRefresh: () => void
}) => {
	const [columns] = useState<typeof defaultColumns>(() => [...defaultColumns])
	const [columnVisibility, setColumnVisibility] = useState({})

	const tanStackTable = useReactTable({
		columns,
		data,
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		rowCount,
		state: {
			columnVisibility,
		},
		onColumnVisibilityChange: setColumnVisibility,
	})

	return (
		<Flex direction="column" maxWidth="calc(100vw - 340px)" flexGrow="1">
			<TableToolbar
				tanStackTable={tanStackTable}
				entriesPerPage={entriesPerPage}
				setEntriesPerPage={setEntriesPerPage}
				responseTime={responseTime}
				doRefresh={doRefresh}
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
											<Flex ml="auto" align="center">
												<Button variant="soft" color="gray" size="1" style={{ padding: "4px" }}>
													<LuChevronsUpDown style={{ fontSize: "var(--font-size-3)" }} />
												</Button>
											</Flex>
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
								{row.getVisibleCells().map((cell) => {
									console.log(cell.column.getSize())
									return (
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
									)
								})}
							</tr>
						))}
					</tbody>
				</table>
			</Box>
		</Flex>
	)
}
