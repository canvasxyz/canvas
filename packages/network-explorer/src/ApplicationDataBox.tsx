import packageJson from "../package.json"

import { Box, Grid, Text } from "@radix-ui/themes"
import { useApplicationData } from "./hooks/useApplicationData.js"

export const ApplicationDataBox = () => {
	const applicationInfo = useApplicationData()

	return (
		<Box mt="auto">
			<Text size="2">
				<Grid columns="2" px="3" py="3" width="auto">
					<Text weight="bold">Status</Text>{" "}
					<Text color="gray">{applicationInfo ? "Connected" : "Offline"}</Text>
					<Text weight="bold">Topic</Text>{" "}
					<Text color="gray">{applicationInfo ? applicationInfo.topic : "-"}</Text>
					<Text weight="bold">Database</Text>{" "}
					<Text color="gray">{applicationInfo ? applicationInfo.database : "-"}</Text>
					<Text weight="bold">Explorer Version</Text>{" "}
					<Text color="gray">v{packageJson.version}</Text>
				</Grid>
			</Text>
		</Box>
	)
}
