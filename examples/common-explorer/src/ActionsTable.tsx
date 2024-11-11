import useSWR from "swr"

import { Box, Flex, Link, Popover, Table, Text } from "@radix-ui/themes"

import PaginationButton from "./components/PaginationButton.js"
import useCursorStack from "./useCursorStack.js"
import { fetchAndIpldParseJson, formatDistanceCustom, Result } from "./utils.js"

import { DidPopover } from "./components/DidPopover.js"
import { Action, Message, Session, Signature } from "@canvas-js/interfaces"

function SessionField({ signature, message }: { signature: Signature; message: Message<Action> }) {
	const { data: sessions, error } = useSWR(
		`/api/sessions?did=${message.payload.did}&publicKey=${signature.publicKey}`,
		fetchAndIpldParseJson<Result<Session>[]>,
	)

	if (error) return <span className="text-red-400">failed to load</span>

	return (
		<span className="text-gray-400">
			{" "}
			{sessions && sessions.length > 0 && formatDistanceCustom(sessions[0].message.payload.context.timestamp)} ago
		</span>
	)
}

const entriesPerPage = 10

function ActionsTable() {
	const { currentCursor, pushCursor, popCursor } = useCursorStack<string>()

	// in order to determine if another page exists, we retrieve n + 1 entries
	// if the length of the result is n + 1, then there is another page
	const params = new URLSearchParams({
		limit: (entriesPerPage + 1).toString(),
	})
	if (currentCursor) {
		params.append("gt", currentCursor)
	}

	const { data: actions, error } = useSWR(
		`/api/actions?${params.toString()}`,
		fetchAndIpldParseJson<Result<Action>[]>,
		{
			refreshInterval: 1000,
		},
	)

	if (error) return <div>failed to load</div>
	if (!actions) return <div>loading...</div>

	const hasMore = actions.length > entriesPerPage
	const actionsToDisplay = actions.slice(0, entriesPerPage)

	return (
		<Flex direction="column" gap="2">
			<Text size="4" weight="bold">
				Latest Actions
			</Text>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.ColumnHeaderCell>Address</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell>Action</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell>Timestamp</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell>Session</Table.ColumnHeaderCell>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{actionsToDisplay.map(({ id, message, signature }) => {
						const args = JSON.stringify(message.payload.args)
						return (
							<Table.Row key={id}>
								<Table.Cell>
									<DidPopover did={message.payload.did} truncateBelow="md" />
								</Table.Cell>
								<Table.Cell>
									<Popover.Root>
										<Popover.Trigger onClick={() => console.log("click")}>
											<Link style={{ cursor: "pointer" }}>{message.payload.name}</Link>
										</Popover.Trigger>
										<Popover.Content>
											name: {message.payload.name}
											<br />
											args: <Text>{args}</Text>
										</Popover.Content>
									</Popover.Root>
								</Table.Cell>
								<Table.Cell>{formatDistanceCustom(message.payload.context.timestamp)} ago</Table.Cell>
								<Table.Cell>
									<DidPopover did={signature.publicKey || ""} truncateBelow="xl" />
									<SessionField message={message} signature={signature} />
								</Table.Cell>
							</Table.Row>
						)
					})}
				</Table.Body>
			</Table.Root>
			<Flex direction="row" gap="2">
				<Box flexGrow="1" />
				<PaginationButton text="Previous" enabled={currentCursor !== null} onClick={popCursor} />
				<PaginationButton
					text="Next"
					enabled={hasMore}
					onClick={() => pushCursor(actionsToDisplay[actionsToDisplay.length - 1].id)}
				/>
			</Flex>
		</Flex>
	)
}

export default ActionsTable
