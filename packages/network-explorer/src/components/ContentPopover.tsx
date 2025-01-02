import { Box, IconButton, Popover } from "@radix-ui/themes"
import { LuBinary } from "react-icons/lu"

export function ContentPopover({ value }: { value: string }) {
	return (
		<Popover.Root>
			<Popover.Trigger>
				<IconButton color="gray" radius="full">
					<LuBinary />
				</IconButton>
			</Popover.Trigger>
			<Popover.Content>
				<Box>{value}</Box>
			</Popover.Content>
		</Popover.Root>
	)
}
