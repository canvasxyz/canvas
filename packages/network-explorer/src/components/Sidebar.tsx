import { Box, Text, Flex, TextField, Link } from "@radix-ui/themes"
import { TableSelector } from "./TableSelector.js"
import { CodeSelector } from "./CodeSelector.js"
import { LuTable } from "react-icons/lu"
import { TableDef } from "../tables.js"
import { useApplicationData } from "../hooks/useApplicationData.js"
import { useState } from "react"

export const Sidebar = ({ tables }: { tables: TableDef[] }) => {
	const [tableSearchTerm, setTableSearchTerm] = useState("")
	const applicationData = useApplicationData()

	const modelNames = applicationData ? Object.keys(applicationData.models) : []
	modelNames.sort()

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
				<Link href="#/" size="3" highContrast color="gray" underline="none" weight="bold">
					⚡️ Explorer
				</Link>
			</Box>
			<Box px="2" py="0.5" pb="2">
				<TextField.Root
					value={tableSearchTerm}
					onChange={(e) => setTableSearchTerm(e.target.value)}
					size="2"
					placeholder="Search tables"
				/>
			</Box>
			<Flex overflowY="scroll" direction="column" gap="3">
				<Box py="5px" px="2">
					<Text size="2" style={{ color: "var(--gray-12)" }} weight="bold">
						Application
					</Text>
				</Box>
				<Box>
					<CodeSelector />
				</Box>
				<Box py="5px" px="2">
					<Text size="2" style={{ color: "var(--gray-12)" }} weight="bold">
						Tables
					</Text>
				</Box>
				<Box>
					{modelNames
						.filter((modelName) => modelName.toLowerCase().includes(tableSearchTerm.toLowerCase()))
						.map((modelName) => (
							<TableSelector
								key={`model-${modelName}`}
								iconType={LuTable}
								label={modelName}
								to={`/models/${modelName}`}
							/>
						))}
				</Box>
				<Box py="5px" px="2">
					<Text size="2" style={{ color: "var(--gray-12)" }} weight="bold">
						Internal
					</Text>
				</Box>
				<Box>
					<TableSelector key={"$actions"} iconType={LuTable} label={"$actions"} to={`/tables/$actions`} />
					{tables
						.filter(({ tableName }) => tableName.toLowerCase().includes(tableSearchTerm.toLowerCase()))
						.map(({ tableName }, key) => (
							<TableSelector key={key} iconType={LuTable} label={tableName} to={`/tables/${tableName}`} />
						))}
				</Box>
			</Flex>
		</Flex>
	)
}
