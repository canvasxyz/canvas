import React from "react"

import type { AppProps } from "next/app"
import { WagmiConfig } from "wagmi"
import { Canvas } from "@canvas-js/hooks"

import { client } from "../utils/client"

import "98.css"
import "styles.css"

const host = "/app"

export default function App({ Component, pageProps }: AppProps) {
	return (
		<React.StrictMode>
			<WagmiConfig client={client}>
				<Canvas host={host}>
					<Component {...pageProps} />
				</Canvas>
			</WagmiConfig>
		</React.StrictMode>
	)
}
