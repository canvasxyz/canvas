import packageJson from "../../package.json"

import { Box, Grid, Text, Popover, IconButton } from "@radix-ui/themes"
import { useApplicationData } from "../hooks/useApplicationData.js"
import { useContractData } from "../hooks/useContractData.js"
import { BASE_URL } from "../utils.js"
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

export const ApplicationData = () => {
	const applicationInfo = useApplicationData()
	const contractInfo = useContractData()

	return (
		<Box mt="auto">
			<Text size="2">
				<Grid columns="auto auto" px="3" py="3" width="auto" gapX="4">
					<Text weight="bold">Upstream</Text>{" "}
					<Text color="gray">
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
							!applicationInfo?.wsConfig.connect && (
								<Text color="gray">
									No connection
									{(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
										!BASE_URL && (
											<>
												<br />
												Missing VITE_API_BASE_URL
											</>
										)}
								</Text>
							)}
					</Text>
					<Text weight="bold">Topic</Text>
					<Text color="gray" wrap="nowrap">
						{applicationInfo ? applicationInfo.topic : "-"}
					</Text>
					<Text weight="bold">Database</Text>{" "}
					<Text color="gray">{applicationInfo ? applicationInfo.database : "-"}</Text>
					<Text weight="bold">Version</Text> <Text color="gray">v{packageJson.version}</Text>
					<Text weight="bold">Snapshot</Text> <Text color="gray">{contractInfo?.snapshotHash ?? "-"}</Text>
				</Grid>
			</Text>
		</Box>
	)
}
