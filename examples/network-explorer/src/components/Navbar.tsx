import { Card } from "@radix-ui/themes"
import { Link as ReactRouterLink } from "react-router-dom"

function Navbar() {
	return (
		<Card className="flex flex-col gap-5">
			{/* --accent-a11 is set by radix-ui, this reflects whatever the accent color has been set to */}
			<ReactRouterLink to="/" style={{ textDecoration: "unset", color: "var(--accent-a11)" }}>
				🌐 &nbsp;Explorer
			</ReactRouterLink>
		</Card>
	)
}

export default Navbar
