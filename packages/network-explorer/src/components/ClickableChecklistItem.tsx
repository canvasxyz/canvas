import { Link, Box, Checkbox, DropdownMenu, Flex } from "@radix-ui/themes"
import { ReactNode, useRef } from "react"

export const ClickableChecklistItem = ({
	color,
	checked,
	onCheckedChange,
	children,
	showOnly,
	selectOnly,
}: {
	color?: any
	checked: boolean
	onCheckedChange: (event: any) => void
	children: ReactNode
	showOnly?: boolean
	selectOnly?: () => void
}) => {
	const ref = useRef<HTMLButtonElement | null>(null)

	return (
		<DropdownMenu.Item
			onClick={(e) => {
				e.preventDefault()
				if (ref.current !== null) ref.current.click()
			}}
			className="contains-links-hover-white"
		>
			<Flex gap="2" align="center" width="100%">
				<Checkbox color={color} ref={ref} checked={checked} onCheckedChange={onCheckedChange} />
				{children}
				<Box flexGrow="1"></Box>
				{showOnly && selectOnly && (
					<Link
						className="link"
						onClick={(e) => {
							e.stopPropagation()
							selectOnly()
						}}
					>
						Only
					</Link>
				)}
			</Flex>
		</DropdownMenu.Item>
	)
}
