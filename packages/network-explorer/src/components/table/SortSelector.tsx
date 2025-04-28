import { LuChevronDown, LuChevronUp, LuChevronsUpDown } from "react-icons/lu"
import { Button, Flex } from "@radix-ui/themes"
import { Header } from "@tanstack/react-table"

export const SortSelector = ({ header }: { header: Header<any, any> }) => (
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
)
