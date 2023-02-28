import React, { useState } from "react"
import ReactDOM from "react-dom/client"
import { WagmiConfig } from "wagmi"

import { Canvas, Client } from "@canvas-js/hooks"

import { AppContext } from "./AppContext"
import { ApplicationStatus } from "./ApplicationStatus"
import { Connect } from "./Connect"
import { Messages } from "./Messages"

import { client } from "./client"

import "98.css"
import "./styles.css"

const root = ReactDOM.createRoot(document.getElementById("root")!)

// This is replaced by webpack at compile-time using DefinePlugin
const host = process.env.HOST!

function Index({}: {}) {
	const [canvasClient, setCanvasClient] = useState<Client | null>(null)

	return (
		<AppContext.Provider value={{ client: canvasClient, setClient: setCanvasClient }}>
			<Messages />
			<div id="sidebar">
				<ApplicationStatus />
				<Connect />
			</div>
		</AppContext.Provider>
	)
}

root.render(
	<React.StrictMode>
		<WagmiConfig client={client}>
			<Canvas host={host}>
				<Index />
			</Canvas>
		</WagmiConfig>
	</React.StrictMode>
)
