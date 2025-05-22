import "../styles.css"

import React from "react"
import ReactDOM from "react-dom/client"

import { Canvas } from "@canvas-js/core"
import { AuthProvider } from "@canvas-js/hooks"

import Forum from "./contract.js"
import Layout from "./Layout.js"

export const ADMIN_DID = "did:pkh:eip155:1:0x34C3A5ea06a3A67229fb21a7043243B0eB3e853f"

export type AppT = Canvas<typeof Forum.models, Forum>

const root = ReactDOM.createRoot(document.getElementById("root")!)

root.render(
	<React.StrictMode>
		<AuthProvider>
			<Layout />
		</AuthProvider>
	</React.StrictMode>,
)
