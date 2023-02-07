import React, { useState } from "react"
import dynamic from "next/dynamic"
import Head from "next/head"

import { Client, useCanvas } from "@canvas-js/hooks"

const Application = dynamic(() => import("components/Application").then(({ Application }) => Application), {
	ssr: false,
})

const Connect = dynamic(() => import("components/Connect").then(({ Connect }) => Connect), { ssr: false })

const Messages = dynamic(() => import("components/Messages").then(({ Messages }) => Messages), { ssr: false })

export default function Index({}) {
	const [client, setClient] = useState<Client | null>(null)

	return (
		<main>
			<Head>
				<title>Canvas Example App</title>
				<meta name="viewport" content="initial-scale=1.0, width=device-width" />
			</Head>
			<Messages client={client} />
			<div id="sidebar">
				<Application />
				<Connect setClient={setClient} />
			</div>
		</main>
	)
}
