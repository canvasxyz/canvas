import { Box, Container, Flex, Heading, Link, Text } from "@radix-ui/themes"
import useSWR from "swr"
import { stringifyRequestParams } from "./components/Table.js"
import { fetchAndIpldParseJson } from "./utils.js"
import { ReactNode } from "react"

const Th = ({ children }: { children: ReactNode }) => (
	<th style={{ padding: "10px", textAlign: "left" }}>
		<Text size="2">{children}</Text>
	</th>
)
const Td = ({ children }: { children: ReactNode }) => (
	<td style={{ padding: "10px" }}>
		<Text size="2">{children}</Text>
	</td>
)

export const LandingPage = () => {
	const { data: actionData } = useSWR(
		`/api/models/$actions?${stringifyRequestParams({
			limit: 3,
		})}`,
		fetchAndIpldParseJson<{
			totalCount: number
			results: { message_id: string; name: string; timestamp: string; did: string }[]
		}>,
		{
			refreshInterval: 1000,
		},
	)
	const actions = actionData && actionData.content.results

	const { data: sessionData } = useSWR(
		`/api/models/$sessions?${stringifyRequestParams({
			limit: 3,
		})}`,
		fetchAndIpldParseJson<{
			totalCount: number
			results: { did: string; public_key: string }[]
		}>,
		{
			refreshInterval: 1000,
		},
	)
	const sessions = sessionData && sessionData.content.results

	return (
		<Container size="2">
			<Flex direction="column" gap="4" pt="9">
				<Heading>Recent actions</Heading>

				<Box style={{ border: "solid var(--gray-6) 1px" }} mb="4">
					<table style={{ borderCollapse: "collapse", width: "100%" }}>
						<thead style={{ backgroundColor: "white" }}>
							<tr style={{ width: "100%", borderBottom: "solid var(--gray-6) 1px" }}>
								<Th>id</Th>
								<Th>name</Th>
								<Th>timestamp</Th>
								<Th>user</Th>
							</tr>
						</thead>
						<tbody style={{ backgroundColor: "white" }}>
							{(actions || []).map((action, index) => (
								<tr key={index}>
									<Td>{action.message_id.slice(0, 10)}</Td>
									<Td>{action.name}</Td>
									<Td>{action.timestamp}</Td>
									<Td>{action.did.slice(0, 30)}...</Td>
								</tr>
							))}
						</tbody>
					</table>
					<Flex direction="row" justify="center" py="2" style={{ borderTop: "solid var(--gray-6) 1px" }}>
						<Link href="#/$actions" color="gray">
							See more
						</Link>
					</Flex>
				</Box>

				<Heading>Recent sessions</Heading>
				<Box style={{ border: "solid var(--gray-6) 1px" }} mb="4">
					<table style={{ borderCollapse: "collapse", width: "100%" }}>
						<thead style={{ backgroundColor: "white" }}>
							<tr style={{ width: "100%", borderBottom: "solid var(--gray-6) 1px" }}>
								<Th>did</Th>
								<Th>public_key</Th>
							</tr>
						</thead>
						<tbody style={{ backgroundColor: "white" }}>
							{(sessions || []).map((session, index) => (
								<tr key={index}>
									<Td>{session.did.slice(0, 30)}...</Td>
									<Td>{session.public_key.slice(0, 30)}...</Td>
								</tr>
							))}
						</tbody>
					</table>
					<Flex direction="row" justify="center" py="2" style={{ borderTop: "solid var(--gray-6) 1px" }}>
						<Link href="#/$sessions" color="gray">
							See more
						</Link>
					</Flex>
				</Box>
			</Flex>
		</Container>
	)
}
