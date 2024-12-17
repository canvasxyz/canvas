import { useState } from "react"
import { IconType } from "react-icons"
import { NavLink } from "react-router-dom"
import { Flex, Link, Text } from "@radix-ui/themes"

export const TableSelector = ({ iconType, label, to }: { iconType: IconType; label: string; to: string }) => {
	const [isHovered, setIsHovered] = useState(false)

	return (
		<Link underline="none" asChild>
			<NavLink to={to}>
				{({ isActive }) => (
					<Flex
						mx="2"
						my="2px"
						p="2"
						align="center"
						gap="8px"
						style={{
							borderRadius: "8px",
							cursor: "pointer",
							userSelect: "none",
							color: isActive ? "#006BCA" : "#60646C",
							backgroundColor: isActive ? "#D5EFFF" : isHovered ? "#f2f0e9" : "transparent",
							fontSize: "94%",
						}}
						onMouseEnter={() => setIsHovered(true)}
						onMouseLeave={() => setIsHovered(false)}
					>
						{iconType({
							size: "1.5em",
							style: { position: "relative", top: 0, marginLeft: "3px", opacity: isActive ? 1 : 0.8 },
						})}
						<Text weight={isActive ? "bold" : "regular"}>{label}</Text>
					</Flex>
				)}
			</NavLink>
		</Link>
	)
}
