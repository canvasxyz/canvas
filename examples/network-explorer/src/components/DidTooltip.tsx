import { Text, Tooltip } from "@radix-ui/themes"

export const DidTooltip = ({ did }: { did: string }) => {
	const address = did.split(":").at(-1) || ""

	const truncatedAddress = address.length > 16 ? `${address.slice(0, 8)}...${address.slice(-8)}` : address

	return (
		<Tooltip content={did}>
			<Text>{truncatedAddress}</Text>
		</Tooltip>
	)
}
