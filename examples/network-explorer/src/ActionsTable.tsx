import useSWR from "swr"
import { Action, Message, Session, Signature } from "@canvas-js/interfaces"
import { Box, Flex, Table, Text } from "@radix-ui/themes"

import ArgsPopout from "./components/ArgsPopout.js"
import PaginationButton from "./components/PaginationButton.js"
import useCursorStack from "./useCursorStack.js"
import { Result, fetchAndIpldParseJson, formatDistanceCustom } from "./utils.js"
import { DidPopover } from "./components/DidPopover.js"

function SessionField({ signature, message }: { signature: Signature; message: Message<Action> }) {
	const { data: session, error } = useSWR(
		`/index_api/latest_session/?did=${message.payload.did}&public_key=${signature.publicKey}`,
		fetchAndIpldParseJson<Session>,
	)

	if (error) return <span className="text-red-400">failed to load</span>

	return <span className="text-gray-400"> {session && formatDistanceCustom(session.context.timestamp)} ago</span>
}

const entriesPerPage = 10

function ActionsTable() {
	const { currentCursor, pushCursor, popCursor } = useCursorStack<string>()

	// in order to determine if another page exists, we retrieve n + 1 entries
	// if the length of the result is n + 1, then there is another page
	const params = new URLSearchParams({
		type: "action",
		limit: (entriesPerPage + 1).toString(),
	})
	if (currentCursor) {
		params.append("before", currentCursor)
	}

	const { data: actions, error } = useSWR(
		`/index_api/messages?${params.toString()}`,
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
						<Table.ColumnHeaderCell>Args</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell>Timestamp</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell>Session</Table.ColumnHeaderCell>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{actionsToDisplay.map(({ id, signature, message }) => {
						const args = JSON.stringify(message.payload.args)
						return (
							<Table.Row key={id}>
								<Table.Cell>
									<DidPopover did={message.payload.did || ""} truncateBelow="md" />
								</Table.Cell>
								<Table.Cell>{message.payload.name}</Table.Cell>
								<Table.Cell>{args.length > 50 ? <ArgsPopout data={args} /> : args}</Table.Cell>
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
					onClick={() => pushCursor(actionsToDisplay[entriesPerPage].id)}
				/>
			</Flex>
		</Flex>
	)
}

export default ActionsTable
