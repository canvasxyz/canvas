import React from "react"
import ReactDOM from "react-dom/client"
import { WagmiConfig } from "wagmi"

import { Canvas } from "@canvas-js/hooks"

import { client } from "./client"
import { App } from "./App"

import "98.css"
import "./styles.css"

const root = ReactDOM.createRoot(document.getElementById("root")!)

root.render(
	<React.StrictMode>
		<WagmiConfig client={client}>
			<Canvas host={process.env.BUNDLER === "server" ? "http://127.0.0.1:8000" : "/"}>
				<App />
			</Canvas>
		</WagmiConfig>
	</React.StrictMode>
)
