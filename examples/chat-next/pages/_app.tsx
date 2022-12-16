import React from "react"

import type { AppProps } from "next/app"
import { Canvas, MultichainConnect } from "@canvas-js/hooks"

import "98.css"
import "styles.css"

const host = "/app"

export default function App({ Component, pageProps }: AppProps) {
	return (
		<React.StrictMode>
			<MultichainConnect>
				<Canvas host={host}>
					<Component {...pageProps} />
				</Canvas>
			</MultichainConnect>
		</React.StrictMode>
	)
}
