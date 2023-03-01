import React from "react"

import { AppProps } from "next/app"

import { WagmiConfig } from "wagmi"
import { Canvas } from "@canvas-js/hooks"

import { client } from "utils/client"

import "98.css"
import "styles.css"

export default function App({ Component, pageProps }: AppProps<{}>) {
	const host = process.env.NEXT_PUBLIC_HOST
	if (host === undefined) {
		throw new Error("no host configured")
	}

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
