import React from "react"
import dynamic from "next/dynamic"
import { GetServerSideProps } from "next"
import Head from "next/head"

import { useCanvas } from "@canvas-js/hooks"

import { ErrorMessage } from "../components/ErrorMessage"

const Connect = dynamic(() => import("../components/Connect").then(({ Connect }) => Connect), { ssr: false })
const Messages = dynamic(() => import("../components/Messages").then(({ Messages }) => Messages), { ssr: false })

export default function Index({}) {
	const { isLoading, error, data } = useCanvas()

	return (
		<main>
			<Head>
				<title>Canvas Example App</title>
				<meta name="viewport" content="initial-scale=1.0, width=device-width" />
			</Head>
			<Messages />
			<div id="sidebar">
				<div className="window">
					<div className="title-bar">
						<div className="title-bar-text">Application</div>
					</div>
					<div className="window-body">
						{isLoading ? <p>Loading...</p> : data ? <p>{data.uri}</p> : <ErrorMessage error={error} />}
					</div>
				</div>
				<Connect />
			</div>
		</main>
	)
}
