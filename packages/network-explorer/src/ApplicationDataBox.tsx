import packageJson from "../package.json"

import { Box, Grid, Text, Popover, IconButton } from "@radix-ui/themes"
import { useApplicationData } from "./hooks/useApplicationData.js"
import { LuUnplug } from "react-icons/lu"

const ConnectionPopover = ({ children }: { children: React.ReactNode }) => {
	return (
		<Popover.Root>
			<Popover.Trigger>
				<IconButton
					variant="ghost"
					color="gray"
					radius="full"
					size="1"
					style={{ position: "relative", top: "3px", left: "-1px" }}
				>
					<LuUnplug color="#6f6f6f" />
				</IconButton>
			</Popover.Trigger>
			<Popover.Content>
				<Text size="2">{children}</Text>
			</Popover.Content>
		</Popover.Root>
	)
}

export const ApplicationDataBox = () => {
	const applicationInfo = useApplicationData()

	return (
		<Box mt="auto">
			<Text size="2">
				<Grid columns="auto auto" px="3" py="3" width="auto" gapX="4">
					<Text weight="bold">Upstream</Text>{" "}
					<Text color="gray">
						{!applicationInfo && <Text color="gray">Offline</Text>}
						{Object.keys(applicationInfo?.networkConfig || {}).length > 0 && (
							<Text color="gray">
								libp2p{" "}
								<ConnectionPopover>
									{applicationInfo?.networkConfig.bootstrapList && (
										<Box>Bootstrap: {JSON.stringify(applicationInfo?.networkConfig.bootstrapList)}</Box>
									)}
									{applicationInfo?.networkConfig.listen && (
										<Box>Listen: {JSON.stringify(applicationInfo?.networkConfig.listen)}</Box>
									)}
									{applicationInfo?.networkConfig.announce && (
										<Box>Announce: {JSON.stringify(applicationInfo?.networkConfig.announce)}</Box>
									)}
								</ConnectionPopover>
							</Text>
						)}
						{applicationInfo?.wsConfig.listen && <Text color="gray">Accepting connections</Text>}
						{applicationInfo?.wsConfig.connect && (
							<Text color="gray">
								WebSocket <ConnectionPopover>{applicationInfo?.wsConfig.connect}</ConnectionPopover>
							</Text>
						)}
						{Object.keys(applicationInfo?.networkConfig || {}).length === 0 &&
							!applicationInfo?.wsConfig.listen &&
							!applicationInfo?.wsConfig.connect && <Text color="gray">No connection</Text>}
					</Text>
					<Text weight="bold">Topic</Text>
					<Text color="gray" wrap="nowrap">
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
