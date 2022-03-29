import type { AppProps } from "next/app"
import Head from "next/head"
import Link from "next/link"

import UserMenu from "components/UserMenu"
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
					<div className="my-4 pb-3.5 border-b border-gray-200">
						<div className="px-10 mx-auto flex">
							<div className="flex-1 font-semibold">
								<Link href="/">Canvas</Link>
							</div>
							<UserMenu />
						</div>
					</div>
					<div className="px-10 mx-auto">
						<Component {...pageProps} />
					</div>
				</div>
			</div>
		</>
	)
}
