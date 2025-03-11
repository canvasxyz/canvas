import { Theme } from "@radix-ui/themes"
import "@radix-ui/themes/styles.css"
import React from "react"
import ReactDOM from "react-dom/client"
import { HashRouter } from "react-router-dom"

import "./index.css"
import { App } from "./App.js"
import { ApplicationDataProvider } from "./hooks/useApplicationData.js"
import { ContractDataProvider } from "./hooks/useContractData.js"

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<HashRouter>
			<Theme>
				<ApplicationDataProvider>
					<ContractDataProvider>
						<App />
					</ContractDataProvider>
				</ApplicationDataProvider>
			</Theme>
		</HashRouter>
	</React.StrictMode>,
)
