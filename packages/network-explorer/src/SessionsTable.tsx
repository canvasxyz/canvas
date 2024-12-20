import useSWR from "swr"
import { Session } from "@canvas-js/interfaces"
import { Box, Flex, Table, Text } from "@radix-ui/themes"

import { fetchAndIpldParseJson, formatDistanceCustom, Result } from "./utils.js"
import PaginationButton from "./components/PaginationButton.js"
import useCursorStack from "./useCursorStack.js"
import { DidPopover } from "./components/DidPopover.js"

const entriesPerPage = 10

function SessionsTable() {
	const { currentCursor, pushCursor, popCursor } = useCursorStack<string>()

	// in order to determine if another page exists, we retrieve n + 1 entries
	// if the length of the result is n + 1, then there is another page
	const params = new URLSearchParams({ limit: (entriesPerPage + 1).toString(), order: "desc" })
	if (currentCursor) {
		params.append("lt", currentCursor)
	}

	const { data: sessions, error } = useSWR(
		`/api/sessions?${params.toString()}`,
		fetchAndIpldParseJson<Result<Session>[]>,
		{
			refreshInterval: 1000,
		},
	)

	if (error) return <div>failed to load</div>
	if (!sessions) return <div>loading...</div>

	const sessionsToDisplay = sessions.slice(0, entriesPerPage)
	const hasMore = sessions.length > entriesPerPage

	return (
		<Flex direction="column" gap="2">
			<Text size="4" weight="bold">
				Latest Sessions
			</Text>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.ColumnHeaderCell>Address</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell>Public Key</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell>Timestamp</Table.ColumnHeaderCell>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{sessionsToDisplay.map(({ id, message }) => {
						return (
							<Table.Row key={id}>
								<Table.Cell>
									<DidPopover did={message.payload.did} truncateBelow="md" numEndChars={0} />
								</Table.Cell>
								<Table.Cell>
									<DidPopover did={message.payload.publicKey} truncateBelow="md" numEndChars={0} />
								</Table.Cell>
								<Table.Cell>
									<span className="text-gray-400">{formatDistanceCustom(message.payload.context.timestamp)}</span> ago
								</Table.Cell>
							</Table.Row>
						)
					})}
				</Table.Body>
			</Table.Root>
			<Flex direction="row" gap="2">
				<Box flexGrow="1" />
				<PaginationButton text="Newer" enabled={currentCursor !== null} onClick={popCursor} />
				<PaginationButton
					text="Older"
					enabled={hasMore}
					onClick={() => pushCursor(sessionsToDisplay[sessionsToDisplay.length - 1].id)}
				/>
			</Flex>
		</Flex>
	)
}

export default SessionsTable
