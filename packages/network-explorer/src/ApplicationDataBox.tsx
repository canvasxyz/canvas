import packageJson from "../package.json"

import { Grid, Text } from "@radix-ui/themes"
import { useApplicationData } from "./hooks/useApplicationData.js"

export const ApplicationDataBox = () => {
	const applicationInfo = useApplicationData()

	return (
		<Grid mt="auto" columns="2">
			<Text weight="bold">Topic</Text>
			<Text color="gray">{applicationInfo ? applicationInfo.topic : "-"}</Text>
			<Text weight="bold">Canvas Node</Text>
			<Text color="gray">v{packageJson.version}</Text>
		</Grid>
	)
}
