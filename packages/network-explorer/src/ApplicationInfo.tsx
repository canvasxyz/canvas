import { version } from "../package.json"

import { Grid, Text } from "@radix-ui/themes"
import { useApplicationInfo } from "./useApplicationInfo.js"

export const ApplicationInfo = () => {
	const applicationInfo = useApplicationInfo()

	return (
		<Grid mt="auto" columns="2">
			<Text weight="bold">Topic</Text>
			<Text color="gray">{applicationInfo ? applicationInfo.topic : "-"}</Text>
			<Text weight="bold">Canvas Node</Text>
			<Text color="gray">v{version}</Text>
			<Text weight="bold">Server Sync</Text>
			<Text color="gray">3 connections</Text>
			<Text weight="bold">Client Sync</Text>
			<Text color="gray">0 connections</Text>
		</Grid>
	)
}
