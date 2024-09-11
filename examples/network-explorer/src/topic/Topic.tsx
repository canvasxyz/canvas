import { useParams } from "react-router-dom"
import useSWR from "swr"

import { fetchAndIpldParseJson } from "../utils.js"
import ActionsTable from "./ActionsTable.js"
import SessionsTable from "./SessionsTable.js"
import { Card, Flex, Tabs, Text } from "@radix-ui/themes"

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
				<Flex direction="row" gap={"10px"}>
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
				</Flex>
			</Card>

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
		</Flex>
	)
}

export default Topic
