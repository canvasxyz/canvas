import React from "react"
import ReactDOM from "react-dom/client"
import { createConfig } from "@wagmi/core"
import { mainnet } from "@wagmi/chains"
import { createPublicClient, http } from "viem"

import "toastify-js/src/toastify.css"
import "./styles.css"

// import { config } from "./config"

import { App } from "./App"

createConfig({
	autoConnect: true,
	publicClient: createPublicClient({ chain: mainnet, transport: http() }),
})

const root = ReactDOM.createRoot(document.getElementById("root")!)

root.render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
)
