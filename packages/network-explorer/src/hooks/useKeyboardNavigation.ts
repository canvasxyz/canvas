import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"

type NavItem = {
	type: string
	label: string
	to: string
}

export const useKeyboardNavigation = (navItems: NavItem[]) => {
	const navigate = useNavigate()
	const location = useLocation()

	const [selectedIndex, setSelectedIndex] = useState(-1)
	useEffect(() => {
		const currentPath = location.pathname
		const index = navItems.findIndex((item) => item.to === currentPath || `/${item.to}` === currentPath)
		setSelectedIndex(index !== -1 ? index : -1)
	}, [navItems])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Only respond to Ctrl+Cmd+Up/Down (Mac) or Ctrl+Alt+Up/Down (Windows)
			const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
			const modifierKey = isMac ? e.metaKey : e.altKey

			if (e.ctrlKey && modifierKey) {
				if (e.key === "ArrowUp") {
					e.preventDefault()
					setSelectedIndex((prev) => {
						const newIndex = prev <= 0 ? navItems.length - 1 : prev - 1
						navigate(navItems[newIndex].to)
						return newIndex
					})
				} else if (e.key === "ArrowDown") {
					e.preventDefault()
					setSelectedIndex((prev) => {
						const newIndex = prev >= navItems.length - 1 ? 0 : prev + 1
						navigate(navItems[newIndex].to)
						return newIndex
					})
				}
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [navItems, navigate])

	return selectedIndex
}
