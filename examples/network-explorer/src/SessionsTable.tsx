import useSWR from "swr"
// import { Session } from "@canvas-js/interfaces"
import { Box, Flex, Table, Text } from "@radix-ui/themes"

import { fetchAndIpldParseJson, formatDistanceCustom } from "./utils.js"
import PaginationButton from "./components/PaginationButton.js"
import useCursorStack from "./useCursorStack.js"
import { DidPopover } from "./components/DidPopover.js"

type SessionRecord = {
	message_id: string
	did: string
	public_key: string
	address: string
	expiration: number | null
}

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
		`/canvas_api/sessions_list?${params.toString()}`,
		fetchAndIpldParseJson<SessionRecord[]>,
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
						<Table.ColumnHeaderCell>Expiration</Table.ColumnHeaderCell>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{sessionsToDisplay.map(({ message_id, did, public_key, expiration }) => {
						return (
							<Table.Row key={message_id}>
								<Table.Cell>
									<DidPopover did={did} truncateBelow="md" numEndChars={0} />
								</Table.Cell>
								<Table.Cell>
									<DidPopover did={public_key} truncateBelow="md" numEndChars={0} />
								</Table.Cell>
								{/* TODO: do we want to display the timestamp (creation date) for the session? */}
								<Table.Cell>
									{expiration !== null ? (
										<span className="text-gray-400">{formatDistanceCustom(expiration)}</span>
									) : (
										"-"
									)}
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
					onClick={() => pushCursor(sessionsToDisplay[entriesPerPage].message_id)}
				/>
			</Flex>
		</Flex>
	)
}

export default SessionsTable
