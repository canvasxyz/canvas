import { Box, Link, Popover } from "@radix-ui/themes"

function truncateAddress(address: string, opts?: { numStartChars?: number; numEndChars?: number }) {
	const opts_ = opts || {}

	// don't handle 0 as undefined
	const numStartChars = opts_.numStartChars === 0 ? 0 : opts_.numStartChars || 8
	const numEndChars = opts_.numEndChars === 0 ? 0 : opts_.numEndChars || 8

	if (address.length <= numStartChars + numEndChars) {
		return address
	}

	const startPart = numStartChars > 0 ? address.slice(0, numStartChars) : ""
	const endPart = numEndChars > 0 ? address.slice(-numEndChars) : ""

	return `${startPart}...${endPart}`
}

export function DidPopover({
	did,
	truncateBelow,
	numStartChars,
	numEndChars,
}: {
	did: string
	truncateBelow?: "initial" | "xs" | "sm" | "md" | "lg" | "xl"
	numStartChars?: number
	numEndChars?: number
}) {
	/**
	 * The `truncateBelow` prop is optional - if the page width goes below the specified breakpoint,
	 * the address will be truncated.
	 *
	 * If it is not given, the address will always be truncated.
	 */

	const didAddress = did.split(":").at(-1)

	const truncatedAddress = didAddress ? truncateAddress(didAddress, { numStartChars, numEndChars }) : ""

	return (
		<Popover.Root>
			<Popover.Trigger>
				{/* <Box display="inline-block"> */}
				<Link style={{ cursor: "pointer" }}>
					{truncateBelow ? (
						<>
							<Box display={{ [truncateBelow]: "none" }}>{truncatedAddress}</Box>
							<Box display={{ initial: "none", [truncateBelow]: "inline-block" }}>{didAddress}</Box>
						</>
					) : (
						truncatedAddress
					)}
				</Link>
			</Popover.Trigger>
			<Popover.Content>
				<Box>{did}</Box>
			</Popover.Content>
		</Popover.Root>
	)
}
