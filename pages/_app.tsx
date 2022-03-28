import type { AppProps } from "next/app"
import Head from "next/head"
import Link from "next/link"

import "../styles/globals.css"

export default function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<Head>
				<title>Canvas Hub</title>
			</Head>
			<div className="app-container">
				<div className="app-header"></div>
				<div className="app-body">
					<div className="my-4 pb-4 border-b border-gray-200">
						<div className="max-w-6xl mx-auto text-lg">
							<Link href="/">Canvas</Link>
						</div>
					</div>
					<div className="max-w-6xl mx-auto">
						<Component {...pageProps} />
					</div>
				</div>
			</div>
		</>
	)
}
