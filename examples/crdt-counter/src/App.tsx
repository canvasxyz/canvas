import React, { useRef, useState } from "react"

import type { SessionSigner } from "@canvas-js/interfaces"

import type { Contract } from "@canvas-js/core"

import { useCanvas, useLiveQuery } from "@canvas-js/hooks"

import { AppContext } from "./AppContext.js"
import { ControlPanel } from "./ControlPanel.js"
import { SessionStatus } from "./SessionStatus.js"
import { ConnectionStatus } from "./ConnectionStatus.js"
import { Connect } from "./connect/index.js"
import { LogStatus } from "./LogStatus.js"
import { assert } from "@canvas-js/utils"
import { PropertyValue } from "@canvas-js/modeldb"

const topic = "crdt-counter.canvas.xyz"

export const contract = {
	models: {
		counter: {
			id: "primary",
			value: "string",
			$merge: (counter1: any, counter2: any) => {
				const counter1Value = JSON.parse(counter1.value)
				const counter2Value = JSON.parse(counter2.value)
				const outputValue: any = {}
				for (const key of Object.keys({ ...counter1Value, ...counter2Value })) {
					outputValue[key] = Math.max(counter1Value[key] || 0, counter2Value[key] || 0)
				}
				return { id: counter1.id, value: JSON.stringify(outputValue) }
			},
		},
	},
	actions: {
		async createCounter(db, {}, { id }) {
			// @ts-ignore
			await db.set("counter", { id, value: JSON.stringify({}) })
		},
		async incrementCounter(db, { id }, { did }) {
			const counter = await db.get("counter", id)
			assert(counter, "Counter not found")
			assert(counter.value, "Counter value not found")
			console.log(counter.value)
			// @ts-ignore
			const value = JSON.parse(counter.value)
			value[did] = (value[did] || 0) + 1
			await db.set("counter", { ...counter, value: JSON.stringify(value) })
		},
	},
} satisfies Contract

export const App: React.FC<{}> = ({}) => {
	const [sessionSigner, setSessionSigner] = useState<SessionSigner | null>(null)
	const [address, setAddress] = useState<string | null>(null)

	const topicRef = useRef(topic)

	const { app } = useCanvas({
		start: false,
		topic,
		contract: { ...contract, topic: topicRef.current },
		signers: sessionSigner ? [sessionSigner] : undefined,
		indexHistory: true,
	})

	const counters = useLiveQuery(app, "counter")
	const canInteract = app && sessionSigner

	async function createCounter() {
		if (canInteract) await app.actions.createCounter({}, { signer: sessionSigner })
	}

	async function increment(id: any) {
		if (canInteract && id) await app.actions.incrementCounter({ id }, { signer: sessionSigner })
	}

	function resolveCounterValue(v: PropertyValue) {
		if (typeof v != "string") {
			return
		}
		let total = 0
		for (const value of Object.values(JSON.parse(v)) as number[]) {
			total += value
		}
		return total
	}

	return (
		<AppContext.Provider value={{ address, setAddress, sessionSigner, setSessionSigner, app: app ?? null }}>
			{app ? (
				<main>
					<div className="flex flex-row gap-4 h-full">
						<div className="min-w-[480px] flex-1 flex flex-col justify-stretch gap-2">
							<button
								className={`border p-2 rounded font-bold ${!canInteract && `cursor-not-allowed`}`}
								onClick={() => createCounter()}
							>
								create counter
							</button>
							{counters &&
								counters.map((counter) => {
									return (
										<div key={counter.id as string} className="flex flex-row gap-2">
											<button
												className={`border p-2 rounded font-bold ${!canInteract && `cursor-not-allowed`}`}
												onClick={() => increment(counter.id)}
											>
												increment {counter.id}
											</button>
											<div>{resolveCounterValue(counter.value)}</div>
										</div>
									)
								})}
						</div>
						<div className="flex flex-col gap-4">
							<Connect />
							<SessionStatus />
							<ConnectionStatus topic={topicRef.current} />
							<LogStatus />
							<ControlPanel />
						</div>
					</div>
				</main>
			) : (
				<></>
			)}
		</AppContext.Provider>
	)
}
