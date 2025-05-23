import React from "react"
import { Box, Flex, Button, Checkbox, Text } from "@radix-ui/themes"
import { Label } from "@radix-ui/react-label"
import { useStagedMigrations } from "../hooks/useStagedMigrations.js"
import { TableChange, RowChange } from "@canvas-js/core"
import { Map as ImmutableMap } from "immutable"
import { useContractData } from "../hooks/useContractData.js"
import { decodeRowKey, encodeRowKey, ImmutableRowKey, RowKey } from "../hooks/useChangedRows.js"
import { HiChevronUp, HiChevronDown } from "react-icons/hi2"

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

function flattenRowChanges(rowChanges: ImmutableMap<string, ImmutableMap<ImmutableRowKey, RowChange>>) {
	const flattened = []
	for (const [tableName, rows] of rowChanges.entries()) {
		for (const [rowKey, rowChange] of rows.entries()) {
			flattened.push({ tableName, row: decodeRowKey(rowKey), rowChange })
		}
	}

	return flattened
}

export const StagedMigrationsBottomSheet = ({ showSidebar }: { showSidebar: boolean }) => {
	const contractData = useContractData()
	const {
		contractChangesets,
		cancelMigrations,
		runMigrations,
		changedRows,
		restoreRowChange,
		migrationIncludesSnapshot,
		setMigrationIncludesSnapshot,
		newContract,
		errors,
	} = useStagedMigrations()

	const rowChangesets = flattenRowChanges(changedRows)
	const isEmpty =
		contractChangesets.length === 0 && rowChangesets.length === 0 && contractChangesets.length === 0 && !newContract

	const [folded, setFolded] = React.useState(false)

	return (
		<Box
			width={showSidebar ? "calc(100% - 200px)" : "100%"}
			overflow="hidden"
			position="fixed"
			bottom="0"
			right="0"
			px="4"
			style={{
				borderTop: "1px solid var(--gray-4)",
				background: "var(--gray-2)",
				opacity: 0.94,
				zIndex: 100,
				height: isEmpty ? 0 : folded ? "56px" : undefined,
				transition: "height 0.3s ease-in-out",
			}}
		>
			<Box pt="15px" position="relative">
				<Text>Staged Migrations</Text>
				<Button
					size="1"
					variant="outline"
					style={{
						position: "absolute",
						top: "15px",
						right: "5px",
					}}
					onClick={() => setFolded(!folded)}
				>
					{folded ? <HiChevronUp size={16} /> : <HiChevronDown size={16} />}
				</Button>
			</Box>
			<Box>
				<Text size="2" className="div">
					<ul>
						{newContract && (
							<li>
								Update contract ({contractData?.originalContract.length} bytes &rarr; {newContract.length} bytes)
							</li>
						)}
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

			{(contractChangesets.length > 0 || changedRows.size > 0 || newContract) && contractData && (
				<Box>
					<Box pb="2">
						<Box px="4" pt="1" pb="4">
							{errors.length > 0 && (
								<Box pb="2">
									<Text size="2" color="red">
										{errors.join("\n")}
									</Text>
								</Box>
							)}
							<Flex align="center">
								<Box mr="5" display="inline-block">
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
								</Box>
								<Box pt="7px" mr="5" display="inline-block">
									<Label>
										<Checkbox
											id="retain-snapshot"
											checked={migrationIncludesSnapshot}
											disabled={changedRows.size > 0}
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
								<Box pt="7px" mr="22px" display="inline-block">
									<Text size="2" style={{ position: "relative", top: "-4px" }}>
										Admin: {contractData.admin?.slice(0, 8)}&hellip;
										{contractData.admin?.slice(contractData.admin?.length - 4)}
									</Text>
								</Box>
							</Flex>
							<Box mt="4" style={{ lineHeight: 1.2 }}>
								<Text size="2">
									{!migrationIncludesSnapshot
										? "This will restart your application, and reapply its action log from scratch."
										: "This will restart your application, with existing data compacted into a snapshot."}
								</Text>
							</Box>
							<Box mt="2" style={{ lineHeight: 1.2 }}>
								<Text size="2">
									{contractData.inMemory
										? "⚠️ Running in-memory contract. This server is not being persisted on disk."
										: "Running a contract stored on disk. Changes will be persisted."}
								</Text>
							</Box>
						</Box>
					</Box>
				</Box>
			)}
		</Box>
	)
}
