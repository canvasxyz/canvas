import React from "react"
import ReactDOM from "react-dom/client"

import { Canvas } from "@canvas-js/hooks"

import { App } from "./App"

const root = ReactDOM.createRoot(document.getElementById("root")!)

root.render(
	<React.StrictMode>
		<Canvas host="http://localhost:8000">
			<App />
		</Canvas>
	</React.StrictMode>
)
