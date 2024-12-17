import { Button, Flex, Grid, Text, TextArea } from "@radix-ui/themes"
import { BiBug, BiCog, BiTable } from "react-icons/bi"
import { TableSelector } from "./TableSelector.js"

const tables = [
	{
		label: "$actions",
		to: "/actions",
	},
	{
		label: "$ancestors",
		to: "/ancestors",
	},
	{
		label: "$branch_merges",
		to: "/branch_merges",
	},
	{
		label: "$dids",
		to: "/dids",
	},
	{
		label: "$effects",
		to: "/effects",
	},
	{
		label: "$heads",
		to: "/heads",
	},
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
		<Flex width="340px" minWidth="340px" height="100%" overflow="hidden" position="relative" direction="column">
			Network Explorer
			<TextArea placeholder="Search tables" />
			<Flex direction="column">
				{tables.map(({ label, to }, key) => (
					<TableSelector key={key} iconType={BiTable} label={label} to={to} />
				))}
			</Flex>
			<Grid mt="auto" columns="2">
				<Text weight="bold">Topic</Text>
				<Text color="gray">common.xyz</Text>
				<Text weight="bold">Canvas Node</Text>
				<Text color="gray">v0.12.6</Text>
				<Text weight="bold">Server Sync</Text>
				<Text color="gray">3 connections</Text>
				<Text weight="bold">Client Sync</Text>
				<Text color="gray">0 connections</Text>
			</Grid>
			<Flex direction="row">
				<Button>
					<BiCog />
				</Button>
				<Button>
					<BiBug />
				</Button>
			</Flex>
		</Flex>
	)
}
