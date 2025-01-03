import { /*Button,*/ Flex, TextField } from "@radix-ui/themes"
// import { BiBug, BiCog } from "react-icons/bi"
import { TableSelector } from "./TableSelector.js"
import { LuTable2 } from "react-icons/lu"
import { ApplicationInfo } from "./ApplicationInfo.js"
import { TableDef } from "./tables.js"
import { useApplicationInfo } from "./useApplicationInfo.js"

export const Sidebar = ({ tables }: { tables: TableDef[] }) => {
	const applicationInfo = useApplicationInfo()

	const modelNames = applicationInfo ? Object.keys(applicationInfo.models) : []
	modelNames.sort()

	return (
		<Flex
			width="340px"
			minWidth="340px"
			height="100%"
			overflow="hidden"
			position="relative"
			direction="column"
			p="2"
			gap="2"
			style={{ borderRight: "1px solid var(--gray-3)" }}
		>
			Network Explorer
			<TextField.Root size="2" placeholder="Search tables" />
			<Flex overflowY="scroll" direction="column" gap="1">
				{tables.map(({ tableName }, key) => (
					<TableSelector key={key} iconType={LuTable2} label={tableName} to={`/${tableName}`} />
				))}

				{modelNames.map((modelName) => (
					<TableSelector key={`model-${modelName}`} iconType={LuTable2} label={modelName} to={`/models/${modelName}`} />
				))}
			</Flex>
			<ApplicationInfo />
			{/* <Flex direction="row" gap="2">
				<Button color="gray" variant="outline">
					<BiCog />
				</Button>
				<Button color="gray" variant="outline">
					<BiBug />
				</Button>
			</Flex> */}
		</Flex>
	)
}
