import { Box, Button, Flex, Text } from "@radix-ui/themes"
import { useStagedMigrations } from "../hooks/useStagedMigrations.js"
import { Changeset } from "@canvas-js/core"
import { useContractData } from "../hooks/useContractData.js"

function ChangesetMigrationRow({ changeset }: { changeset: Changeset }) {
	switch (changeset.change) {
		case "create_table":
			return <li>Create table: {changeset.table}</li>
		case "drop_table":
			return <li>Drop table: {changeset.table}</li>
		case "add_column":
			return (
				<li>
					Add column: {changeset.table}.{changeset.column} as{" "}
					{changeset.propertyType.endsWith("?") ? "nullable" : "non-nullable"}{" "}
					{changeset.propertyType.replace(/\?$/, "")}
				</li>
			)
		case "remove_column":
			return (
				<li>
					Drop column: {changeset.table}.{changeset.column}
				</li>
			)
		case "make_optional_column":
			return (
				<li>
					Make column nullable: {changeset.table}.{changeset.column}
				</li>
			)
	}
}

export const StagedMigrationsSidebar = () => {
	const contractData = useContractData()
	const { contractChangesets, cancelMigrations, runMigrations, waitingForCommit, commitCompleted } =
		useStagedMigrations()

	return (
		<Flex
			width="400px"
			minWidth="400px"
			height="100%"
			overflow="hidden"
			position="fixed"
			right="0"
			top="0"
			direction="column"
			p="2"
			gap="2"
			style={{ borderRight: "1px solid var(--gray-4)", background: "var(--gray-2)", zIndex: 100 }}
		>
			<Box px="2" pt="10px" pb="9px">
				Staged Migrations
			</Box>
			<Box pb="2">
				<ul>
					{contractChangesets.map((changeset, index) => (
						<ChangesetMigrationRow key={index} changeset={changeset} />
					))}
				</ul>
			</Box>

			{contractChangesets.length > 0 && contractData && (
				<Box mt="5">
					<Box
						mt="2"
						style={{
							width: "100%",
							border: "1px solid var(--gray-6)",
							borderRadius: "2px",
						}}
					>
						<Box
							px="4"
							py="3"
							style={{
								borderBottom: "1px solid var(--gray-6)",
							}}
						>
							<Text size="2">Run Migrations</Text>
						</Box>

						<Box px="4" pt="1" pb="4">
							<Box mt="4" pt="1">
								<Button
									size="2"
									variant="solid"
									onClick={(e) => {
										e.preventDefault()
										runMigrations()
									}}
								>
									Sign and Commit Changes
								</Button>
								&nbsp;
								<Button
									size="2"
									variant="outline"
									onClick={(e) => {
										e.preventDefault()
										cancelMigrations()
									}}
								>
									Cancel
								</Button>
							</Box>

							<Box mt="4">
								<Text size="2">Upgrade controller key: {contractData.admin}</Text>
							</Box>
							<Box mt="1">
								<Text size="2">
									Contract stored{" "}
									{contractData.inMemory
										? "in-memory. Changes will be lost when the explorer server restarts."
										: "on disk. Changes will be persisted on the explorer server."}
								</Text>
							</Box>
						</Box>
					</Box>
				</Box>
			)}

			{waitingForCommit && (
				<Box mt="4">
					<Text size="2">Waiting for server...</Text>
				</Box>
			)}

			{commitCompleted && (
				<Box mt="4">
					<Text size="2">Changes committed!</Text>
				</Box>
			)}
		</Flex>
	)
}
