import { Box } from "@radix-ui/themes"
import { Link as ReactRouterLink } from "react-router-dom"
import { useTheme } from "../hooks/useTheme.js"

function Navbar() {
	const { theme } = useTheme()

	return (
		<Box pt="2" pb="4">
			<ReactRouterLink
				to="/"
				style={{
					textDecoration: "unset",
					fontWeight: "var(--font-weight-bold)",
					color: theme === "dark" ? "var(--gray-12)" : "black",
				}}
			>
				🌐 &nbsp;Explorer
			</ReactRouterLink>
		</Box>
	)
}

export default Navbar
