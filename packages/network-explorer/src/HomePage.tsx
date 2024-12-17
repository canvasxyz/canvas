import { version } from "../package.json"
import { fetchAndIpldParseJson } from "./utils.js"
import { Card, Flex, Grid, TabNav, Text } from "@radix-ui/themes"
import ActionsTable from "./ActionsTable.js"
import SessionsTable from "./SessionsTable.js"
import NetworkPlot from "./NetworkPlot.js"
import { Link, Navigate, Route, Routes, useLocation, useResolvedPath } from "react-router-dom"
import useSWR from "swr"

function HomePage() {
	const { data: appInfoData } = useSWR(`/api/`, fetchAndIpldParseJson<{ topic: string; database: string }>)
	const { data: actionCountData } = useSWR(`/api/actions/count`, fetchAndIpldParseJson<{ count: number }>, {
		refreshInterval: 1000,
	})
	const { data: sessionCountData } = useSWR(`/api/sessions/count`, fetchAndIpldParseJson<{ count: number }>, {
		refreshInterval: 1000,
	})

	const { data: userCountData } = useSWR(`/api/dids/count`, fetchAndIpldParseJson<{ count: number }>, {
		refreshInterval: 1000,
	})

	const location = useLocation()
	const actionsPath = useResolvedPath("./actions")
	const sessionsPath = useResolvedPath("./sessions")
	const networkPath = useResolvedPath("./network")

	return (
		<Flex direction="column" gap="4" pt="4">
			<Text size="7" weight="bold">
				{appInfoData ? appInfoData.topic : "..."}
			</Text>
			<Card>
				<Grid columns="1fr 1fr" gap="4">
					<Flex direction="column">
						<Flex gap="2">
							<Text weight="bold">Status:</Text>
							<Text weight="medium">Online, running v{version}</Text>
						</Flex>
						<Flex gap="2">
							<Text weight="bold">Unique addresses:</Text>
							<Text weight="medium">{userCountData ? userCountData.count : "-"}</Text>
						</Flex>
						<Flex gap="2">
							<Text weight="bold">Database:</Text>
							<Text weight="medium">{appInfoData ? appInfoData.database : "-"}</Text>
						</Flex>
					</Flex>
				</Grid>
			</Card>

			<TabNav.Root>
				<TabNav.Link asChild active={location.pathname === actionsPath.pathname}>
					<Link to="./actions">Actions {actionCountData ? `(${actionCountData.count})` : ""}</Link>
				</TabNav.Link>
				<TabNav.Link asChild active={location.pathname === sessionsPath.pathname}>
					<Link to="./sessions">Sessions {sessionCountData ? `(${sessionCountData.count})` : ""}</Link>
				</TabNav.Link>
				<TabNav.Link asChild active={location.pathname === networkPath.pathname}>
					<Link to="./network">Network</Link>
				</TabNav.Link>
			</TabNav.Root>

			<Routes>
				<Route path="/" element={<Navigate to="actions" replace={true} />} />
				<Route path="network" element={<NetworkPlot />} />
				<Route path="actions" element={<ActionsTable />} />
				<Route path="sessions" element={<SessionsTable />} />
			</Routes>
		</Flex>
	)
}

export default HomePage
