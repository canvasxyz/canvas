import { useState } from "react"
import { NavLink } from "react-router-dom"
import { Flex, Link, Text } from "@radix-ui/themes"

import { LuBinary, LuArrowBigRightDash, LuWrench } from "react-icons/lu"

export const CodeSelector = ({ option }: { option: "view" | "edit" | "admin" }) => {
	const [isHovered, setIsHovered] = useState(false)

	const fontSize = "2"

	let iconType, to, label

	if (option === "view") {
		iconType = LuBinary
		to = "/contract/view"
		label = "Contract Code"
	} else if (option === "edit") {
		iconType = LuArrowBigRightDash
		to = "/contract/edit"
		label = "Migrate"
	} else if (option === "admin") {
		iconType = LuWrench
		to = "/contract/admin"
		label = "Admin"
	} else {
		throw new Error("unexpected icon type")
	}

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
