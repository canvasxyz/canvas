import useSWR from "swr"

import { Box, Flex, Link, Popover, Table, Text } from "@radix-ui/themes"

import PaginationButton from "./components/PaginationButton.js"
import useCursorStack from "./useCursorStack.js"
import { fetchAndIpldParseJson, formatDistanceCustom, Result } from "./utils.js"

import { DidPopover } from "./components/DidPopover.js"
import { Action, Message, Session, Signature } from "@canvas-js/interfaces"

type ActionRecord = {
	message_id: string
	did: string
	name: string
	timestamp: number
}

function ActionRow({ message_id, did, timestamp, name }: ActionRecord) {
	const { data: messageData } = useSWR(`/canvas_api/messages/${message_id}`, fetchAndIpldParseJson<Result<Action>>)

	return (
		<Table.Row>
			<Table.Cell>
				<DidPopover did={did || ""} truncateBelow="md" />
			</Table.Cell>
			<Table.Cell>
				<Popover.Root>
					<Popover.Trigger onClick={() => console.log("click")}>
						<Link style={{ cursor: "pointer" }}>{name}</Link>
					</Popover.Trigger>
					<Popover.Content>
						name: {name}
						<br />
						args:{" "}
						{messageData ? <Text>{JSON.stringify(messageData.message.payload.args)}</Text> : <Text>Loading...</Text>}
					</Popover.Content>
				</Popover.Root>
			</Table.Cell>
			<Table.Cell>{formatDistanceCustom(timestamp)} ago</Table.Cell>
			<Table.Cell>
				{messageData ? <DidPopover did={messageData.signature.publicKey || ""} truncateBelow="xl" /> : null}
				{messageData ? <SessionField message={messageData.message} signature={messageData.signature} /> : null}
			</Table.Cell>
		</Table.Row>
	)
}

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
		limit: (entriesPerPage + 1).toString(),
	})
	if (currentCursor) {
		params.append("before", currentCursor)
	}

	const { data: actions, error } = useSWR(
		`/canvas_api/actions_list?${params.toString()}`,
		fetchAndIpldParseJson<ActionRecord[]>,
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
						<Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell>Timestamp</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell>Session</Table.ColumnHeaderCell>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{actionsToDisplay.map((actionRecord) => (
						<ActionRow key={actionRecord.message_id} {...actionRecord} />
					))}
				</Table.Body>
			</Table.Root>
			<Flex direction="row" gap="2">
				<Box flexGrow="1" />
				<PaginationButton text="Previous" enabled={currentCursor !== null} onClick={popCursor} />
				<PaginationButton
					text="Next"
					enabled={hasMore}
					onClick={() => pushCursor(actionsToDisplay[entriesPerPage].message_id)}
				/>
			</Flex>
		</Flex>
	)
}

export default ActionsTable
