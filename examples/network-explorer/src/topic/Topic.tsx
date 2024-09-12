import { Navigate, NavLink, Route, Routes, useParams } from "react-router-dom"
import useSWR from "swr"

import { fetchAndIpldParseJson } from "../utils.js"
import NetworkPlot from "./NetworkPlot.js"
import ActionsTable from "./ActionsTable.js"
import SessionsTable from "./SessionsTable.js"
import { Box, Card, Flex, Tabs, Text } from "@radix-ui/themes"

function Topic() {
	const { topic } = useParams()

	if (!topic) {
		// TODO: 404 page
		return <div>Topic not found</div>
	}

	const { data: countsData } = useSWR(
		`/index_api/counts/${topic}`,
		fetchAndIpldParseJson<{ topic: string; action_count: number; session_count: number; address_count: number }>,
		{
			refreshInterval: 1000,
		},
	)

	return (
		<Flex direction="column" gap="4" pt="4">
			<Card>
				<Flex direction="row" gap={"4"}>
					<Flex direction="column">
						<Text weight="bold">Topic</Text>
						<Text weight="medium">{topic}</Text>
					</Flex>
					<Flex direction="column">
						<Text weight="bold">Messages</Text>
						<Text weight="medium">{countsData ? countsData.action_count + countsData.session_count : "..."}</Text>
					</Flex>
					<Flex direction="column">
						<Text weight="bold">Addresses</Text>
						<Text weight="medium">{countsData ? countsData.address_count : "..."}</Text>
					</Flex>
					<Box flexGrow="1" />
					<NavLink
						to="table"
						className={({ isActive }) =>
							`btn border ${isActive && "bg-gray-100 border-gray-500"}  font-bold py-2 px-4 rounded`
						}
					>
						Table view
					</NavLink>
					<NavLink
						to="network"
						className={({ isActive }) =>
							`btn border ${isActive && "bg-gray-100 border-gray-500"}  font-bold py-2 px-4 rounded`
						}
					>
						Network view
					</NavLink>
				</Flex>
			</Card>

			<Routes>
				<Route path="/" element={<Navigate to="./table" replace={true} />} />
				<Route path="network" element={<NetworkPlot topic={topic} />} />
				<Route
					path="table"
					element={
						<Tabs.Root defaultValue="actions">
							<Tabs.List>
								<Tabs.Trigger value="actions">Actions</Tabs.Trigger>
								<Tabs.Trigger value="sessions">Sessions</Tabs.Trigger>
							</Tabs.List>
							<Tabs.Content value="actions">
								<ActionsTable topic={topic} />
							</Tabs.Content>

							<Tabs.Content value="sessions">
								<SessionsTable topic={topic} />
							</Tabs.Content>
						</Tabs.Root>
					}
				/>
			</Routes>
		</Flex>
	)
}

export default Topic
