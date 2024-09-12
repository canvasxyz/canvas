import useSWR from "swr"
import { Action, Session } from "@canvas-js/interfaces"
import { Link } from "react-router-dom"

import { version } from "../../package.json"
import ArgsPopout from "../components/ArgsPopout.js"
import { BASE_URL, Result, fetchAndIpldParseJson, formatDistanceCustom } from "../utils.js"
import { Card, Flex, Grid, Table, Text } from "@radix-ui/themes"
import { DidTooltip } from "../components/DidTooltip.js"

function HomePage() {
	const { data: countsData, error: countsError } = useSWR(
		"/index_api/counts",
		fetchAndIpldParseJson<
			{
				topic: string
				address_count: number
				session_count: number
				action_count: number
				connection_count: number
				connections: string[]
			}[]
		>,
		{
			refreshInterval: 1000,
		},
	)

	const { data, error } = useSWR("/index_api/messages", fetchAndIpldParseJson<Result<Action | Session>[]>, {
		refreshInterval: 1000,
	})

	if (error || countsError) return <div>failed to load</div>
	if (!data || !countsData) return <div>loading...</div>

	const actions = data.filter((item) => item.message.payload.type === "action") as Result<Action>[]

	return (
		<Flex direction="column" gap="4" pt="4">
			<Card>
				<Flex direction="column">
					<Text weight="bold">Status:</Text>
					<Text weight="medium">Online, running v{version}</Text>
					<Text weight="medium">{BASE_URL}</Text>
				</Flex>
			</Card>

			<Grid columns="2" gap="4">
				<Flex direction="column" gap="2">
					<Text>Topics</Text>
					<Card>
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.ColumnHeaderCell>Topic</Table.ColumnHeaderCell>
									<Table.ColumnHeaderCell>Messages</Table.ColumnHeaderCell>
									<Table.ColumnHeaderCell>Connections</Table.ColumnHeaderCell>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{countsData.map((row) => (
									<Table.Row key={row.topic}>
										<Table.Cell>
											<Link to={`topic/${row.topic}`}>{row.topic}</Link>
										</Table.Cell>
										<Table.Cell>{row.action_count + row.session_count}</Table.Cell>
										<Table.Cell>
											<Flex direction="row" gap="2">
												<ArgsPopout
													data={JSON.stringify(row.connections)}
													placeholder={row.connection_count.toString()}
												/>
											</Flex>
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table.Root>
					</Card>
				</Flex>
				<Flex direction="column" gap="2">
					<Text>Latest Actions</Text>
					<Card>
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.ColumnHeaderCell>Address</Table.ColumnHeaderCell>
									<Table.ColumnHeaderCell>Action</Table.ColumnHeaderCell>
									<Table.ColumnHeaderCell>Args</Table.ColumnHeaderCell>
									<Table.ColumnHeaderCell>Timestamp</Table.ColumnHeaderCell>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{actions.map(({ id, message }) => {
									return (
										<Table.Row key={id}>
											<Table.Cell>
												<DidTooltip did={message.payload.did || ""} />
											</Table.Cell>
											<Table.Cell>{message.payload.name}</Table.Cell>
											<Table.Cell>
												<ArgsPopout data={JSON.stringify(message.payload.args)} />
											</Table.Cell>
											<Table.Cell>
												{formatDistanceCustom(message.payload.context.timestamp).replace("about ", "~")} ago
											</Table.Cell>
										</Table.Row>
									)
								})}
							</Table.Body>
						</Table.Root>
					</Card>
				</Flex>
			</Grid>
		</Flex>
	)
}

export default HomePage
