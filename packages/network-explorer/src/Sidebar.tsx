import { Button, Flex, TextField } from "@radix-ui/themes"
import { BiBug, BiCog } from "react-icons/bi"
import { TableSelector } from "./TableSelector.js"
import { LuTable2 } from "react-icons/lu"
import { ApplicationInfo } from "./ApplicationInfo.js"

const tables = [
	{
		label: "$actions",
		to: "/actions",
	},
	// {
	// 	label: "$ancestors",
	// 	to: "/ancestors",
	// },
	// {
	// 	label: "$branch_merges",
	// 	to: "/branch_merges",
	// },
	// {
	// 	label: "$dids",
	// 	to: "/dids",
	// },
	// {
	// 	label: "$effects",
	// 	to: "/effects",
	// },
	// {
	// 	label: "$heads",
	// 	to: "/heads",
	// },
	{
		label: "$messages",
		to: "/messages",
	},
	{
		label: "$sessions",
		to: "/sessions",
	},
]

export const Sidebar = () => {
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
			<Flex direction="column" gap="1">
				{tables.map(({ label, to }, key) => (
					<TableSelector key={key} iconType={LuTable2} label={label} to={to} />
				))}
			</Flex>
			<ApplicationInfo />
			<Flex direction="row" gap="2">
				<Button color="gray" variant="outline">
					<BiCog />
				</Button>
				<Button color="gray" variant="outline">
					<BiBug />
				</Button>
			</Flex>
		</Flex>
	)
}
