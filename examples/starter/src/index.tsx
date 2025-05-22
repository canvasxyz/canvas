import "../styles.css"

import React from "react"
import ReactDOM from "react-dom/client"

import { AuthProvider } from "@canvas-js/hooks"
import Layout from "./Layout.js"

const root = ReactDOM.createRoot(document.getElementById("root")!)

root.render(
	<React.StrictMode>
		<AuthProvider>
			<Layout />
		</AuthProvider>
	</React.StrictMode>,
)
