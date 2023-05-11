import React from "react"
import ReactDOM from "react-dom/client"
import { WagmiConfig } from "wagmi"

import { App } from "./App"

import "./styles.css"
import "toastify-js/src/toastify.css"

const root = ReactDOM.createRoot(document.getElementById("root")!)

// This is replaced by webpack at compile-time using DefinePlugin
const host = process.env.HOST!

root.render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
)
