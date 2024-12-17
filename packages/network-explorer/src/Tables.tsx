import { Box, Flex } from "@radix-ui/themes"
import { TableToolbar } from "./TableToolbar.js"

export const Tables = () => {
	return (
		<Flex direction="column" height="100%" flexGrow="1">
			<TableToolbar />

			<Box flexGrow="1" style={{ backgroundColor: "lightblue" }}>
				{/* table */}
			</Box>
		</Flex>
	)
}
