import { Theme } from "@radix-ui/themes"
import "@radix-ui/themes/styles.css"
import React from "react"
import ReactDOM from "react-dom/client"
import { HashRouter } from "react-router-dom"

import "./index.css"
import { App } from "./App.js"
import { ApplicationDataProvider } from "./hooks/useApplicationData.js"
import { ContractDataProvider } from "./hooks/useContractData.js"
import { ThemeProvider, useTheme } from "./hooks/useTheme.js"
import { ThemeToggle } from "./components/ThemeToggle.js"
import { StagedMigrationsProvider } from "./hooks/useStagedMigrations.js"

function ThemedApp() {
	const { theme } = useTheme()

	return (
		<Theme appearance={theme}>
			<ApplicationDataProvider>
				<ContractDataProvider>
					<StagedMigrationsProvider>
						<ThemeToggle />
						<App />
					</StagedMigrationsProvider>
				</ContractDataProvider>
			</ApplicationDataProvider>
		</Theme>
	)
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<HashRouter>
			<ThemeProvider>
				<ThemedApp />
			</ThemeProvider>
		</HashRouter>
	</React.StrictMode>,
)
