import { Box, Popover } from "@radix-ui/themes"

function truncateAddress(address: string) {
	const numStartChars = 8
	const numEndChars = 8
	return address.length > numStartChars + numEndChars
		? `${address.slice(0, numStartChars)}...${address.slice(-numEndChars)}`
		: address
}

export function DidPopover({
	did,
	truncateBelow,
}: {
	did: string
	truncateBelow?: "initial" | "xs" | "sm" | "md" | "lg" | "xl"
}) {
	/**
	 * The `truncateBelow` prop is optional - if the page width goes below the specified breakpoint,
	 * the address will be truncated.
	 *
	 * If it is not given, the address will always be truncated.
	 */

	const didAddress = did.split(":").at(-1)

	return (
		<Popover.Root>
			<Popover.Trigger>
				<Box display="inline-block">
					{truncateBelow ? (
						<>
							<Box display={{ [truncateBelow]: "none" }}>{didAddress ? truncateAddress(didAddress) : ""}</Box>
							<Box display={{ initial: "none", [truncateBelow]: "inline-block" }}>{didAddress}</Box>
						</>
					) : didAddress ? (
						truncateAddress(didAddress)
					) : (
						""
					)}
				</Box>
			</Popover.Trigger>
			<Popover.Content>
				<Box>{did}</Box>
			</Popover.Content>
		</Popover.Root>
	)
}
