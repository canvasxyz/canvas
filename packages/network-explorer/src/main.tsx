import { Theme } from "@radix-ui/themes"
import "@radix-ui/themes/styles.css"
import React from "react"
import ReactDOM from "react-dom/client"
import { HashRouter } from "react-router-dom"

import "./index.css"
import { App } from "./App.js"

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<HashRouter>
			<Theme>
				<App />
			</Theme>
		</HashRouter>
	</React.StrictMode>,
)
