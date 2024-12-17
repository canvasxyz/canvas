import { Box, Button, Flex, Text, TextField } from "@radix-ui/themes"
import { BiChevronLeft, BiChevronRight, BiFilter, BiSidebar } from "react-icons/bi"
import { FaClockRotateLeft } from "react-icons/fa6"
import { LuDownload, LuRefreshCw, LuSlidersHorizontal } from "react-icons/lu"

export const TableToolbar = ({ responseTime }: { responseTime?: number }) => {
	return (
		<Flex style={{ borderBottom: "1px solid var(--gray-3)" }} align="center" gap="2" p="2">
			<Button color="gray" variant="outline">
				<BiSidebar />
			</Button>

			<Flex>
				<Button color="gray" variant="outline" style={{ borderTopRightRadius: "0px", borderBottomRightRadius: "0px" }}>
					<BiChevronLeft />
				</Button>
				<Button color="gray" variant="outline" style={{ borderTopLeftRadius: "0px", borderBottomLeftRadius: "0px" }}>
					<BiChevronRight />
				</Button>
			</Flex>

			<Button color="gray" variant="outline">
				<FaClockRotateLeft />
			</Button>

			<Button color="gray" variant="outline">
				<BiFilter />
				Filters
			</Button>

			<Button color="gray" variant="outline">
				<LuSlidersHorizontal />
				Columns
			</Button>

			<Button color="gray" variant="outline">
				Add record
			</Button>

			<Box ml="auto">
				<Text>0 rows &bull; {responseTime ? `${responseTime}ms` : "-"}</Text>
			</Box>

			<Flex>
				<Button color="gray" variant="outline" style={{ borderTopRightRadius: "0px", borderBottomRightRadius: "0px" }}>
					<BiChevronLeft />
				</Button>
				<TextField.Root style={{ borderRadius: "0px", width: "40px" }} />
				<TextField.Root style={{ borderRadius: "0px", width: "40px" }} />
				<Button color="gray" variant="outline" style={{ borderTopLeftRadius: "0px", borderBottomLeftRadius: "0px" }}>
					<BiChevronRight />
				</Button>
			</Flex>

			<Button color="gray" variant="outline">
				<LuRefreshCw />
			</Button>

			<Button color="gray" variant="outline">
				<LuDownload />
			</Button>
		</Flex>
	)
}
