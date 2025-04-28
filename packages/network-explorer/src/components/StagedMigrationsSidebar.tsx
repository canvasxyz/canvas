import { Box, Button, Checkbox, Text } from "@radix-ui/themes"
import { Label } from "@radix-ui/react-label"
import { useStagedMigrations } from "../hooks/useStagedMigrations.js"
import { TableChange, ModelValue, RowChange } from "@canvas-js/core"
import { Map as ImmutableMap, List as ImmutableList } from "immutable"
import { useContractData } from "../hooks/useContractData.js"
import { decodeRowKey, encodeRowKey, ImmutableRowKey, RowKey } from "../hooks/useChangedRows.js"

function ChangesetMigrationRow({ changeset }: { changeset: TableChange }) {
	switch (changeset.change) {
		case "create_table":
			return <>Create table: {changeset.table}</>
		case "drop_table":
			return <>Drop table: {changeset.table}</>
		case "add_column":
			return (
				<>
					Add column: {changeset.table}.{changeset.column} as{" "}
					{changeset.propertyType.endsWith("?") ? "nullable" : "non-nullable"}{" "}
					{changeset.propertyType.replace(/\?$/, "")}
				</>
			)
		case "remove_column":
			return (
				<>
					Drop column: {changeset.table}.{changeset.column}
				</>
			)
		case "make_optional_column":
			return (
				<>
					Make column nullable: {changeset.table}.{changeset.column}
				</>
			)
	}
}

function RowChangeRow({ rowKey, rowChange, tableName }: { rowKey: RowKey; rowChange: RowChange; tableName: string }) {
	const formattedRowKey = rowKey.length === 1 ? rowKey[0] : encodeRowKey(rowKey)

	switch (rowChange.type) {
		case "create":
			return (
				<>
					Create row in "{tableName}" {JSON.stringify(rowChange.value, null, 2)}
				</>
			)
		case "delete":
			return (
				<>
					Delete {formattedRowKey} in "{tableName}"
				</>
			)
		case "update":
			return (
				<>
					Update {formattedRowKey} in "{tableName}"
				</>
			)
	}
}

function flattenRowChanges(
	rowChanges: ImmutableMap<string, ImmutableMap<ImmutableRowKey, RowChange>>,
	newRows: ImmutableMap<string, ImmutableList<ModelValue>>,
) {
	const flattened = []
	for (const [tableName, rows] of rowChanges.entries()) {
		for (const [rowKey, rowChange] of rows.entries()) {
			flattened.push({ tableName, row: decodeRowKey(rowKey), rowChange })
		}
	}

	for (const [tableName, rows] of newRows.entries()) {
		for (const row of rows) {
			flattened.push({ tableName, row: [], rowChange: { type: "create" as const, value: row } })
		}
	}

	return flattened
}

export const StagedMigrationsSidebar = ({ showSidebar }: { showSidebar: boolean }) => {
	const contractData = useContractData()
	const {
		contractChangesets,
		cancelMigrations,
		runMigrations,
		waitingForCommit,
		commitCompleted,
		changedRows,
		restoreRowChange,
		migrationIncludesSnapshot,
		setMigrationIncludesSnapshot,
		newRows,
	} = useStagedMigrations()

	const rowChangesets = flattenRowChanges(changedRows, newRows)
	const isEmpty = contractChangesets.length === 0 && rowChangesets.length === 0

	return (
		<Box
			width={showSidebar ? "calc(100% - 200px)" : "100%"}
			overflow="hidden"
			position="fixed"
			bottom="0"
			right="0"
			px="4"
			style={{
				borderRight: "1px solid var(--gray-4)",
				background: "var(--gray-2)",
				opacity: 0.94,
				zIndex: 100,
				height: isEmpty ? 0 : undefined,
				transition: "height 0.3s ease-in-out",
			}}
		>
			<Box pt="15px">
				<Text>Staged Migrations</Text>
			</Box>
			<Box>
				<Text size="2" className="div">
					<ul>
						{contractChangesets.map((changeset, index) => (
							<li key={index}>
								<ChangesetMigrationRow changeset={changeset} />
							</li>
						))}
						{rowChangesets.map(({ tableName, row, rowChange }, index) => (
							<li key={index}>
								<pre>
									<RowChangeRow rowKey={row} rowChange={rowChange} tableName={tableName} />
									&nbsp;[
									<a
										href="#"
										onClick={(e) => {
											e.preventDefault()
											restoreRowChange(tableName, row)
										}}
									>
										x
									</a>
									]
								</pre>
							</li>
						))}
					</ul>
				</Text>
			</Box>

			{(contractChangesets.length > 0 || changedRows.size > 0 || newRows.size > 0) && contractData && (
				<Box>
					<Box pb="2">
						<Box px="4" pt="1" pb="4">
							<Box>
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
										if (confirm("Reset all staged changes?")) cancelMigrations()
									}}
								>
									Cancel
								</Button>
								<Box mt="2" ml="4" display="inline-block">
									<Label>
										<Checkbox
											id="retain-snapshot"
											checked={migrationIncludesSnapshot}
											disabled={changedRows.size > 0 || newRows.size > 0}
											onCheckedChange={(value) => {
												if (value === "indeterminate") return
												setMigrationIncludesSnapshot(value)
											}}
										/>
										<Text size="2" style={{ position: "relative", top: "-4px", left: "6px" }}>
											Start from snapshot
										</Text>
									</Label>
								</Box>
							</Box>

							<Box mt="3">
								<Text size="2">
									{contractData.inMemory
										? "⚠️ Running in-memory contract. Changes will not be persisted to disk."
										: "Running a contract stored on disk. Changes will be persisted."}
								</Text>
							</Box>

							<Box mt="1">
								<Text size="2">Admin: {contractData.admin}</Text>
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
		</Box>
	)
}
