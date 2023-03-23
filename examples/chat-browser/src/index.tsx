import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom/client"
import { WagmiConfig } from "wagmi"

import { Core } from "@canvas-js/core"

import { AppContext } from "./AppContext"
import { ApplicationStatus } from "./Application"
import { Connect } from "./Connect"
import { Messages } from "./Messages"

// @ts-ignore
import spec from "../spec.canvas.js"

import { client } from "./client"

import "98.css"
import "./styles.css"
import { Canvas, Client } from "@canvas-js/hooks"
import { Stats } from "./Stats"

const root = ReactDOM.createRoot(document.getElementById("root")!)

function Index({}: {}) {
	const [client, setClient] = useState<Client | null>(null)
	const [core, setCore] = useState<Core | null>(null)

	useEffect(() => {
		console.log("initializing core", spec)
		fetch(spec)
			.then((res) => res.text())
			.then((spec) => Core.initialize({ directory: "canvas-chat", spec, replay: true, unchecked: true, verbose: true }))
			.then((core) => setCore(core))
	}, [])

	useEffect(() => console.log("got core", core), [core])

	return (
		<Canvas host={core}>
			<AppContext.Provider value={{ core, client, setClient }}>
				<Messages />
				<div id="sidebar">
					<ApplicationStatus />
					<Connect />
					<Stats />
				</div>
			</AppContext.Provider>
		</Canvas>
	)
}

root.render(
	<WagmiConfig client={client}>
		<Index />
	</WagmiConfig>
)
