import { Button, Flex, TextField } from "@radix-ui/themes"
import { BiChevronLeft, BiChevronRight } from "react-icons/bi"

export const PaginationControl = ({
	entriesPerPage,
	setEntriesPerPage,
	canGoPrevious,
	goPreviousPage,
	canGoNext,
	goNextPage,
}: {
	defaultEntriesPerPage: number
	entriesPerPage: number
	setEntriesPerPage: (entriesPerPage: number) => void
	canGoPrevious: boolean
	goPreviousPage: () => void
	canGoNext: boolean
	goNextPage: () => void
}) => {
	return (
		<Flex>
			<Button
				disabled={!canGoPrevious}
				onClick={goPreviousPage}
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
				disabled={!canGoNext}
				onClick={goNextPage}
				color="gray"
				variant="outline"
				style={{ borderTopLeftRadius: "0px", borderBottomLeftRadius: "0px" }}
			>
				<BiChevronRight />
			</Button>
		</Flex>
	)
}
