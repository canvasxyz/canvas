import { Box, Button, Checkbox, Flex, Text } from "@radix-ui/themes"
import { TableToolbar } from "./TableToolbar.js"
import { LuChevronsUpDown } from "react-icons/lu"
import { flexRender, Table as TanStackTable } from "@tanstack/react-table"

export type Column = {
	name: string
	type: "string" | "number"
}

export const Table = ({
	tanStackTable,
	responseTime,
	entriesPerPage,
	setEntriesPerPage,
}: {
	tanStackTable: TanStackTable<any>
	responseTime?: number
	entriesPerPage: number
	setEntriesPerPage: (entriesPerPage: number) => void
}) => {
	return (
		<Flex direction="column" height="100%" flexGrow="1">
			<TableToolbar entriesPerPage={entriesPerPage} setEntriesPerPage={setEntriesPerPage} responseTime={responseTime} />

			<Box flexGrow="1">
				<table style={{ borderCollapse: "collapse" }}>
					<thead>
						{tanStackTable.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id}>
								<th
									style={{
										borderWidth: "1px",
										borderTopWidth: "0px",
										borderLeftWidth: "0px",
										borderColor: "var(--accent-3)",
										borderStyle: "solid",
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
											borderWidth: "1px",
											borderTopWidth: "0px",
											borderColor: "var(--accent-3)",
											borderStyle: "solid",
										}}
									>
										<Flex gap="2" p="1">
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
					<tbody>
						{tanStackTable.getRowModel().rows.map((row) => (
							<tr key={row.id}>
								<td
									style={{
										borderWidth: "1px",
										borderTopWidth: "0px",
										borderLeftWidth: "0px",
										borderColor: "var(--accent-3)",
										borderStyle: "solid",
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
											borderColor: "var(--accent-3)",
											borderStyle: "solid",
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
