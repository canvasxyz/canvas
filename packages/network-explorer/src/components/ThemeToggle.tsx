import { IconButton } from "@radix-ui/themes"
import { FiSun, FiMoon } from "react-icons/fi"
import { useTheme } from "../hooks/useTheme.js"

export function ThemeToggle() {
	const { theme, toggleTheme } = useTheme()

	return (
		<div style={{ position: "fixed", bottom: 20, left: 20, zIndex: 50 }}>
			<IconButton
				size="2"
				variant="soft"
				onClick={toggleTheme}
				aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
			>
				{theme === "light" ? <FiMoon /> : <FiSun />}
			</IconButton>
		</div>
	)
}
