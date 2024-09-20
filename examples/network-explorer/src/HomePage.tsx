import { version } from "../package.json"
import { BASE_URL } from "./utils.js"
import { Card, Flex, TabNav, Text } from "@radix-ui/themes"
import ActionsTable from "./ActionsTable.js"
import SessionsTable from "./SessionsTable.js"
import NetworkPlot from "./NetworkPlot.js"
import { Link, Navigate, Route, Routes, useLocation, useResolvedPath } from "react-router-dom"

function HomePage() {
	const location = useLocation()
	const actionsPath = useResolvedPath("./actions")
	const sessionsPath = useResolvedPath("./sessions")
	const networkPath = useResolvedPath("./network")

	return (
		<Flex direction="column" gap="4" pt="4">
			<Card>
				<Flex direction="column">
					<Text weight="bold">Status:</Text>
					<Text weight="medium">Online, running v{version}</Text>
					<Text weight="medium">{BASE_URL}</Text>
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
				<Route path="network" element={<NetworkPlot />} />
				<Route path="actions" element={<ActionsTable />} />
				<Route path="sessions" element={<SessionsTable />} />
			</Routes>
		</Flex>
	)
}

export default HomePage
