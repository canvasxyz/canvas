import { Box, Button, Checkbox, Flex, Text } from "@radix-ui/themes"
import { TableToolbar } from "./TableToolbar.js"
import { LuChevronsUpDown } from "react-icons/lu"

export type Column = {
	name: string
	type: "string" | "number"
}

export const Table = ({ rows, columns, responseTime }: { rows: any[]; columns: Column[]; responseTime?: number }) => {
	return (
		<Flex direction="column" height="100%" flexGrow="1">
			<TableToolbar responseTime={responseTime} />

			<Box flexGrow="1">
				<table style={{ borderCollapse: "collapse" }}>
					<thead>
						<tr>
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
							{columns.map((column, index) => (
								<th
									key={index}
									style={{
										borderWidth: "1px",
										borderTopWidth: "0px",
										borderColor: "var(--accent-3)",
										borderStyle: "solid",
									}}
								>
									<Flex gap="2" p="1">
										<Text weight="medium">{column.name}</Text>
										<Flex ml="auto" align="center">
											<Button variant="soft" color="gray" size="1" style={{ padding: "4px" }}>
												<LuChevronsUpDown style={{ fontSize: "var(--font-size-3)" }} />
											</Button>
										</Flex>
									</Flex>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{(rows || []).map((action, index) => (
							<tr key={index}>
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
								{columns.map((column, index) => (
									<td
										key={index}
										style={{
											borderWidth: "1px",
											borderTopWidth: "0px",
											borderColor: "var(--accent-3)",
											borderStyle: "solid",
										}}
									>
										<Flex gap="2" p="1">
											<Text>{(action as any)[column.name]}</Text>
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
