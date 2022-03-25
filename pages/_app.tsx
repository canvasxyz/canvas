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
			<div className="app-header"></div>
			<div className="app-body">
				<div className="max-w-6xl my-6 mx-auto">
					<div className="mb-10 text-xl">
						<Link href="/">Canvas</Link>
					</div>
					<Component {...pageProps} />
				</div>
			</div>
		</>
	)
}
