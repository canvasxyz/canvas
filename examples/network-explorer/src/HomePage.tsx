import { version } from "../package.json"
import { BASE_URL } from "./utils.js"
import { Card, Flex, Tabs, Text } from "@radix-ui/themes"
import ActionsTable from "./ActionsTable.js"
import SessionsTable from "./SessionsTable.js"

function HomePage() {
	return (
		<Flex direction="column" gap="4" pt="4">
			<Card>
				<Flex direction="column">
					<Text weight="bold">Status:</Text>
					<Text weight="medium">Online, running v{version}</Text>
					<Text weight="medium">{BASE_URL}</Text>
				</Flex>
			</Card>

			<Tabs.Root defaultValue="actions">
				<Tabs.List>
					<Tabs.Trigger value="actions">Actions</Tabs.Trigger>
					<Tabs.Trigger value="sessions">Sessions</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="actions">
					<ActionsTable />
				</Tabs.Content>

				<Tabs.Content value="sessions">
					<SessionsTable />
				</Tabs.Content>
			</Tabs.Root>
		</Flex>
	)
}

export default HomePage
