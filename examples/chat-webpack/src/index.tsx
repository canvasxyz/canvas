import React from "react"
import ReactDOM from "react-dom/client"
import { WagmiConfig } from "wagmi"

import { Canvas } from "@canvas-js/hooks"

import { client } from "./client"
import { App } from "./App"

import "98.css"
import "./styles.css"

const root = ReactDOM.createRoot(document.getElementById("root")!)

// This is replaced by webpack at compile-time using DefinePlugin
const host = process.env.HOST!

root.render(
	<React.StrictMode>
		<WagmiConfig client={client}>
			<Canvas host={host}>
				<App />
			</Canvas>
		</WagmiConfig>
	</React.StrictMode>
)
