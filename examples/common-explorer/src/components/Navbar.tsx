import { Box } from "@radix-ui/themes"
import { Link as ReactRouterLink } from "react-router-dom"

function Navbar() {
	return (
		<Box pt="2" pb="4">
			<ReactRouterLink
				to="/"
				style={{
					textDecoration: "unset",
					fontWeight: "var(--font-weight-bold)",
					color: "black",
				}}
			>
				🌐 &nbsp;Explorer
			</ReactRouterLink>
		</Box>
	)
}

export default Navbar
