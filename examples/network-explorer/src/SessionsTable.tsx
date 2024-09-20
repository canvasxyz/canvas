import useSWR from "swr"
import { Session } from "@canvas-js/interfaces"
import { Box, Flex, Table, Text } from "@radix-ui/themes"

import { Result, fetchAndIpldParseJson, formatDistanceCustom } from "./utils.js"
import PaginationButton from "./components/PaginationButton.js"
import useCursorStack from "./useCursorStack.js"
import { DidPopover } from "./components/DidPopover.js"

const entriesPerPage = 10

function SessionsTable() {
	const { currentCursor, pushCursor, popCursor } = useCursorStack<string>()

	// in order to determine if another page exists, we retrieve n + 1 entries
	// if the length of the result is n + 1, then there is another page
	const params = new URLSearchParams({ type: "session", limit: (entriesPerPage + 1).toString() })
	if (currentCursor) {
		params.append("before", currentCursor)
	}

	const { data: sessions, error } = useSWR(
		`/index_api/messages?${params.toString()}`,
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
		<Flex direction="column" gap="2" pt="4">
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
					{sessionsToDisplay.map((item) => {
						const cid = item[0]
						const message = item[2]

						return (
							<Table.Row key={cid}>
								<Table.Cell>
									<DidPopover did={message.payload.did} truncateBelow="md" numEndChars={0} />
								</Table.Cell>
								<Table.Cell>
									<DidPopover did={message.payload.publicKey} truncateBelow="md" numEndChars={0} />
								</Table.Cell>
								<Table.Cell>
									<span className="text-gray-400">{formatDistanceCustom(message.payload.context.timestamp)} ago</span>
								</Table.Cell>
							</Table.Row>
						)
					})}
				</Table.Body>
			</Table.Root>
			<Flex direction="row" gap="2">
				<Box flexGrow="1" />
				<PaginationButton text="Previous" enabled={currentCursor !== null} onClick={popCursor} />
				<PaginationButton text="Next" enabled={hasMore} onClick={() => pushCursor(sessions[entriesPerPage][0])} />
			</Flex>
		</Flex>
	)
}

export default SessionsTable
