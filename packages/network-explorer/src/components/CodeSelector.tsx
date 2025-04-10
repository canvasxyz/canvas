import { useState } from "react"
import { NavLink } from "react-router-dom"
import { Flex, Link, Text } from "@radix-ui/themes"

import { LuBinary } from "react-icons/lu"

export const CodeSelector = () => {
	const [isHovered, setIsHovered] = useState(false)
	const fontSize = "2"

	return (
		<Link underline="none" asChild>
			<NavLink to="/contract">
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
							color: isActive ? "var(--gray-12)" : "var(--gray-12)",
							backgroundColor: isActive ? "var(--gray-4)" : isHovered ? "var(--gray-3)" : "transparent",
						}}
						onMouseEnter={() => setIsHovered(true)}
						onMouseLeave={() => setIsHovered(false)}
					>
						{LuBinary({
							style: {
								fontSize: `var(--font-size-${fontSize})`,
								position: "relative",
								marginLeft: "3px",
								opacity: isActive ? 1 : 0.8,
							},
						})}
						<Text size={`${fontSize}`} weight="medium">
							Contract
						</Text>
					</Flex>
				)}
			</NavLink>
		</Link>
	)
}
