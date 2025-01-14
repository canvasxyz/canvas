import { Box, Container, Flex, Heading, Link, Text } from "@radix-ui/themes"
import useSWR from "swr"
import { stringifyRequestParams } from "./components/Table.js"
import { fetchAndIpldParseJson } from "./utils.js"
import { ReactNode } from "react"

const Th = ({ children }: { children: ReactNode }) => (
	<th style={{ padding: "8px 6px 8px 14px", textAlign: "left" }}>
		<Text size="2">{children}</Text>
	</th>
)
const Td = ({ children, first }: { children: ReactNode; first: boolean }) => (
	<td style={{ padding: first ? "12px 14px 8px" : "8px 14px" }}>
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
			results: { message_id: string; name: string; timestamp: number; did: string }[]
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
		<Container size="3">
			<Flex direction="column" gap="4" pt="9" mx="3">
				<Heading size="5">Recent actions</Heading>

				<Box style={{ border: "solid var(--gray-4) 1px", lineHeight: 1.25 }} mb="4">
					<table style={{ borderCollapse: "collapse", width: "100%" }}>
						<thead style={{ backgroundColor: "white" }}>
							<tr style={{ width: "100%", borderBottom: "solid var(--gray-4) 1px" }}>
								<Th>id</Th>
								<Th>name</Th>
								<Th>timestamp</Th>
								<Th>user</Th>
							</tr>
						</thead>
						<tbody style={{ backgroundColor: "white" }}>
							{(actions || []).map((action, index) => (
								<tr key={index}>
									<Td first={index === 0}>{action.message_id.slice(0, 10)}</Td>
									<Td first={index === 0}>{action.name}</Td>
									<Td first={index === 0}>{new Date(action.timestamp).toLocaleString()}</Td>
									<Td first={index === 0}>{action.did.slice(0, 30)}...</Td>
								</tr>
							))}
						</tbody>
					</table>
					<Flex direction="row" justify="center" py="2" mt="2" style={{ borderTop: "solid var(--gray-4) 1px" }}>
						<Text size="2">
							<Link href="#/$actions" color="gray" underline="none">
								See more
							</Link>
						</Text>
					</Flex>
				</Box>

				<Heading size="5">Recent sessions</Heading>
				<Box style={{ border: "solid var(--gray-4) 1px", lineHeight: 1.25 }} mb="4">
					<table style={{ borderCollapse: "collapse", width: "100%" }}>
						<thead style={{ backgroundColor: "white" }}>
							<tr style={{ width: "100%", borderBottom: "solid var(--gray-4) 1px" }}>
								<Th>did</Th>
								<Th>public_key</Th>
							</tr>
						</thead>
						<tbody style={{ backgroundColor: "white" }}>
							{(sessions || []).map((session, index) => (
								<tr key={index}>
									<Td first={index === 0}>{session.did.slice(0, 30)}...</Td>
									<Td first={index === 0}>{session.public_key.slice(0, 30)}...</Td>
								</tr>
							))}
						</tbody>
					</table>
					<Flex direction="row" justify="center" py="2" mt="2" style={{ borderTop: "solid var(--gray-4) 1px" }}>
						<Text size="2">
							<Link href="#/$sessions" color="gray" underline="none">
								See more
							</Link>
						</Text>
					</Flex>
				</Box>
			</Flex>
		</Container>
	)
}
