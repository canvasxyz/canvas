import { version } from "../package.json"
import { BASE_URL, fetchAndIpldParseJson } from "./utils.js"
import { Card, Flex, Grid, TabNav, Text } from "@radix-ui/themes"
import ActionsTable from "./ActionsTable.js"
import SessionsTable from "./SessionsTable.js"
import NetworkPlot from "./NetworkPlot.js"
import { Link, Navigate, Route, Routes, useLocation, useResolvedPath } from "react-router-dom"
import useSWR from "swr"

function HomePage() {
	const { data: countsData } = useSWR(
		`/index_api/counts/`,
		fetchAndIpldParseJson<{ topic: string; action_count: number; session_count: number; address_count: number }>,
		{
			refreshInterval: 1000,
		},
	)

	const location = useLocation()
	const actionsPath = useResolvedPath("./actions")
	const sessionsPath = useResolvedPath("./sessions")
	const networkPath = useResolvedPath("./network")

	console.log(countsData)

	return (
		<Flex direction="column" gap="4" pt="4">
			<Card>
				<Grid columns="1fr 1fr" gap="4">
					<Flex direction="column">
						<Flex gap="2">
							<Text weight="bold">Status:</Text>
							<Text weight="medium">Online, running v{version}</Text>
						</Flex>
						<Flex gap="2">
							<Text weight="bold">URL:</Text>
							<Text weight="medium">{BASE_URL}</Text>
						</Flex>
						<Flex gap="2">
							<Text weight="bold">Unique addresses:</Text>
							<Text weight="medium">{countsData ? countsData.address_count : "-"}</Text>
						</Flex>
					</Flex>
				</Grid>
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
				<Route path="network" element={<NetworkPlot />} />
				<Route path="actions" element={<ActionsTable />} />
				<Route path="sessions" element={<SessionsTable />} />
			</Routes>
		</Flex>
	)
}

export default HomePage
