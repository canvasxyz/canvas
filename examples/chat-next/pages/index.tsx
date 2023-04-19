import React, { useState } from "react"
import Head from "next/head"

import { Connect } from "components/Connect"
import { Messages } from "components/Messages"
import { Application } from "components/Application"
import { Stats } from "components/Stats"

import { Client } from "@canvas-js/hooks"

export default function Index() {
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
				<Connect client={client} setClient={setClient} />
				<Stats />
			</div>
		</main>
	)
}
