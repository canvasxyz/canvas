import { useState } from "react"
import { IconType } from "react-icons"
import { NavLink } from "react-router-dom"
import { Flex, Link, Text } from "@radix-ui/themes"

export const TableSelector = ({ iconType, label, to }: { iconType: IconType; label: string; to: string }) => {
	const [isHovered, setIsHovered] = useState(false)

	const fontSize = "2"

	return (
		<Link underline="none" asChild>
			<NavLink to={to}>
				{({ isActive }) => (
					<Flex
						py="5px"
						px="2"
						align="center"
						gap="2"
						style={{
							borderRadius: "4px",
							cursor: "pointer",
							userSelect: "none",
							color: isActive ? "var(--gray-12)" : "var(--gray-11)",
							backgroundColor: isActive ? "var(--gray-3)" : isHovered ? "var(--gray-2)" : "transparent",
						}}
						onMouseEnter={() => setIsHovered(true)}
						onMouseLeave={() => setIsHovered(false)}
					>
						{iconType({
							style: {
								fontSize: `var(--font-size-${fontSize})`,
								position: "relative",
								marginLeft: "3px",
								opacity: isActive ? 1 : 0.8,
							},
						})}
						<Text size={`${fontSize}`} weight="medium">
							{label}
						</Text>
					</Flex>
				)}
			</NavLink>
		</Link>
	)
}
