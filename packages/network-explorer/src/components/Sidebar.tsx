import { Box, Text, Flex, TextField, Link } from "@radix-ui/themes"
import { TableSelector } from "./TableSelector.js"
import { CodeSelector } from "./CodeSelector.js"
import { LuTable, LuLayoutPanelLeft } from "react-icons/lu"
import { NavLink } from "react-router-dom"
import { TableDef } from "../tables.js"
import { useApplicationData } from "../hooks/useApplicationData.js"
import { useState, useMemo } from "react"
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation.js"

export const Sidebar = ({ tables }: { tables: TableDef[] }) => {
	const [tableSearchTerm, setTableSearchTerm] = useState("")
	const [isHovered, setIsHovered] = useState(false)
	const applicationData = useApplicationData()

	const modelNames = applicationData ? Object.keys(applicationData.models) : []
	modelNames.sort()

	const navItems = useMemo(() => [
		{ type: "app", label: "Application", to: "/" },
		{ type: "contract", label: "contract.ts", to: "/contract" },
		...modelNames.map((name) => ({ type: "model", label: name, to: `/models/${name}` })),
		{ type: "table", label: "$actions", to: "/tables/$actions" },
		...tables
			.filter(({ tableName }) => tableName.toLowerCase().includes(tableSearchTerm.toLowerCase()))
			.map(({ tableName }) => ({
				type: "table",
				label: tableName,
				to: `/tables/${tableName}`,
			})),
	], [modelNames, tables, tableSearchTerm]);
	useKeyboardNavigation(navItems)

	return (
		<Flex
			width="200px"
			minWidth="200px"
			height="100%"
			overflow="hidden"
			position="fixed"
			left="0"
			top="0"
			direction="column"
			p="2"
			gap="2"
			style={{ borderRight: "1px solid var(--gray-4)", background: "var(--gray-2)", zIndex: 100 }}
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
				<Box pt="2">
					<Link underline="none" asChild>
						<NavLink to="/">
							{({ isActive }) => (
								<Flex
									py="5px"
									px="2"
									align="center"
									gap="2"
									onMouseEnter={() => setIsHovered(true)}
									onMouseLeave={() => setIsHovered(false)}
									style={{
										borderRadius: "4px",
										cursor: "pointer",
										userSelect: "none",
										color: isActive ? "var(--gray-12)" : "var(--gray-12)",
										backgroundColor: isActive ? "var(--gray-4)" : isHovered ? "var(--gray-3)" : "transparent",
									}}
								>
									<LuLayoutPanelLeft
										style={{
											fontSize: `var(--font-size-2)`,
											position: "relative",
											marginLeft: "3px",
											opacity: isActive ? 1 : 0.8,
										}}
									/>
									<Text size="2" weight="medium">
										Dashboard
									</Text>
								</Flex>
							)}
						</NavLink>
					</Link>
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
