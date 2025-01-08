import packageJson from "../package.json"

import { Box, Grid, Text } from "@radix-ui/themes"
import { useApplicationData } from "./hooks/useApplicationData.js"

export const ApplicationDataBox = () => {
	const applicationInfo = useApplicationData()

	return (
		<Box mt="auto">
			<Text size="2">
				<Grid 
					columns="auto auto" 
					px="3"
					py="3" 
					width="auto"
					gapX="4"
				>
					<Text weight="bold">Status</Text> <Text color="gray">{applicationInfo ? "Connected" : "Offline"}</Text>
					<Text weight="bold">Topic</Text> 
					<Text color="gray" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
						{applicationInfo ? applicationInfo.topic : "-"}
					</Text>
					<Text weight="bold">Database</Text>{" "}
					<Text color="gray">{applicationInfo ? applicationInfo.database : "-"}</Text>
					<Text weight="bold">Version</Text> <Text color="gray">v{packageJson.version}</Text>
				</Grid>
			</Text>
		</Box>
	)
}
