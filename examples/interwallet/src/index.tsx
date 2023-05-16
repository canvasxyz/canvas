import React from "react"
import ReactDOM from "react-dom/client"
import { WagmiConfig } from "wagmi"

import "./styles.css"
import "toastify-js/src/toastify.css"

import { config } from "./config"

import { App } from "./App"

const root = ReactDOM.createRoot(document.getElementById("root")!)

root.render(
	<React.StrictMode>
		<WagmiConfig config={config}>
			<App />
		</WagmiConfig>
	</React.StrictMode>
)
