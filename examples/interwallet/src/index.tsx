import React from "react"
import ReactDOM from "react-dom/client"
import { WagmiConfig } from "wagmi"

import "./styles.css"
import "toastify-js/src/toastify.css"

import { config } from "./config"

import { App } from "./App"

// import { libp2p } from "./stores/libp2p"

// console.log("got libp2p!??", libp2p)

// {
// 	;(window as any).libp2p = libp2p
// }

const root = ReactDOM.createRoot(document.getElementById("root")!)

root.render(
	<React.StrictMode>
		<WagmiConfig config={config}>
			<App />
		</WagmiConfig>
	</React.StrictMode>
)
