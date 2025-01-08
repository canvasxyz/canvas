import packageJson from "../package.json"

import { Grid, Text } from "@radix-ui/themes"
import { useApplicationData } from "./hooks/useApplicationData.js"

export const ApplicationData = () => {
	const applicationInfo = useApplicationData()

	return (
		<Grid mt="auto" columns="2">
			<Text weight="bold">Topic</Text>
			<Text color="gray">{applicationInfo ? applicationInfo.topic : "-"}</Text>
			<Text weight="bold">Canvas Node</Text>
			<Text color="gray">v{packageJson.version}</Text>
			{/* TODO: what live syncing information can we display from the server? */}
			{/* merkle tree hash? */}
			{/* <Text weight="bold">Server Sync</Text>
			<Text color="gray">3 connections</Text>
			<Text weight="bold">Client Sync</Text>
			<Text color="gray">0 connections</Text> */}
		</Grid>
	)
}
