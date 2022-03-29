import { Toaster } from "react-hot-toast"
import { Transition } from "@tailwindui/react"

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
					<Toaster position="top-center" reverseOrder={false}>
						{(t) => (
							<Transition
								appear
								show={t.visible}
								className="transform px-4 py-3 pb-2.5 mt-3 rounded shadow-lg bg-red-500 text-white"
								enter="transition-all duration-150"
								enterFrom="opacity-0 scale-50"
								enterTo="opacity-100 scale-100"
								leave="transition-all duration-150"
								leaveFrom="opacity-100 scale-100"
								leaveTo="opacity-0 scale-75"
							>
								{t.message}
							</Transition>
						)}
					</Toaster>
				</div>
			</div>
		</>
	)
}
