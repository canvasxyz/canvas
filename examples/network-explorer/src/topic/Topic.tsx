import { Link, Navigate, Route, Routes, useLocation, useParams, useResolvedPath } from "react-router-dom"
import useSWR from "swr"

import { fetchAndIpldParseJson } from "../utils.js"
import NetworkPlot from "./NetworkPlot.js"
import ActionsTable from "./ActionsTable.js"
import SessionsTable from "./SessionsTable.js"
import { Box, Card, Flex, TabNav, Text } from "@radix-ui/themes"

function Topic() {
	const { topic } = useParams()
	const location = useLocation()
	const actionsPath = useResolvedPath("./actions")
	const sessionsPath = useResolvedPath("./sessions")
	const networkPath = useResolvedPath("./network")

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
				</Flex>
			</Card>

			<TabNav.Root>
				<TabNav.Link asChild active={location.pathname === actionsPath.pathname}>
					<Link to="./actions">Actions</Link>
				</TabNav.Link>
				<TabNav.Link asChild active={location.pathname === sessionsPath.pathname}>
					<Link to="./sessions">Sessions</Link>
				</TabNav.Link>
				<TabNav.Link asChild active={location.pathname === networkPath.pathname}>
					<Link to="./network">Network</Link>
				</TabNav.Link>
			</TabNav.Root>

			<Routes>
				<Route path="/" element={<Navigate to="./actions" replace={true} />} />
				<Route path="network" element={<NetworkPlot topic={topic} />} />
				<Route path="actions" element={<ActionsTable topic={topic} />} />
				<Route path="sessions" element={<SessionsTable topic={topic} />} />
			</Routes>
		</Flex>
	)
}

export default Topic
