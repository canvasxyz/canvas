import useSWR from "swr"
import { version } from "../package.json"

import { Grid, Text } from "@radix-ui/themes"
import { fetchAndIpldParseJson } from "./utils.js"

export const ApplicationInfo = () => {
	const { data } = useSWR(`/api/`, fetchAndIpldParseJson<{ topic: string; database: string }>, {
		refreshInterval: 1000,
	})

	console.log(data)

	return (
		<Grid mt="auto" columns="2">
			<Text weight="bold">Topic</Text>
			<Text color="gray">{data ? data.content.topic : "-"}</Text>
			<Text weight="bold">Canvas Node</Text>
			<Text color="gray">v{version}</Text>
			<Text weight="bold">Server Sync</Text>
			<Text color="gray">3 connections</Text>
			<Text weight="bold">Client Sync</Text>
			<Text color="gray">0 connections</Text>
		</Grid>
	)
}
