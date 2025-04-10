import { Box, Flex } from "@radix-ui/themes"
import { useStagedMigrations } from "../hooks/useStagedMigrations.js"

export const StagedMigrationsSidebar = () => {
	const { contractChangesets } = useStagedMigrations()
	return (
		<Flex
			width="200px"
			minWidth="200px"
			height="100%"
			overflow="hidden"
			position="relative"
			direction="column"
			p="2"
			gap="2"
			style={{ borderRight: "1px solid var(--gray-4)", background: "var(--gray-2)" }}
		>
			<Box px="2" pt="10px" pb="9px">
				Staged Migrations
			</Box>
			<Box px="2" pb="2">
				{contractChangesets.map((changeset, index) => (
					<Box key={index}>{changeset.change}</Box>
				))}
			</Box>
		</Flex>
	)
}
