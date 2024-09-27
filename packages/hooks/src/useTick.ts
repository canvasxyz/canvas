import { useEffect } from "react"
import type { Canvas, Contract, CanvasLogEvent, ActionImplementation } from "@canvas-js/core"
import type { Action } from "@canvas-js/interfaces"

export type TickingContract = Contract & {
	actions: {
		tick: ActionImplementation
	}
}

// const tickState = { last: 0 }

export const useTick = (
	app: Canvas<TickingContract> | undefined,
	condition: string | boolean | null,
	interval: number,
) => {
	useEffect(() => {
		if (!app) return
		console.log("useTick: setting up")

		if (condition !== null && typeof condition !== "string" && typeof condition !== "boolean") {
			throw new Error("useTick: invalid condition")
		}
		if (typeof interval !== "number") {
			throw new Error("useTick: invalid interval")
		}

		let queryNot: boolean
		let queryTable: string
		let queryRow: string
		let queryPath: string

		// const tickSynchronizer = async (event: CanvasLogEvent) => {
		// 	const payload = event.detail.message.payload
		// 	if (payload.type === "action") {
		// 		const action = payload as Action

		// 		for (const signer of app.signers.getAll()) {
		// 			if (signer.hasSession(app.topic, action.did)) {
		// 				return
		// 			}
		// 		}

		// 		if (action.name === "tick") {
		// 			tickState.last = Date.now()
		// 		}
		// 	}
		// }

		// app.addEventListener("message", tickSynchronizer)

		if (typeof condition === "string") {
			const matches = condition.match(/^(!)?(\w+)\.(\w+).(\w+)$/)

			if (!matches) {
				throw new Error("useTick: invalid condition, must match model.field or !model.field")
			}

			queryNot = matches[1] === "!"
			queryTable = matches[2]
			queryRow = matches[3]
			queryPath = matches[4]
		}

		const timer = setInterval(async () => {
			// don't tick if another tick was received recently
			// if (tickState.last > Date.now() - interval) {
			// 	return
			// }

			// don't tick if the condition isn't satisfied
			if (typeof condition === "string") {
				const result = await app.db.get(queryTable, queryRow)
				if (!result) {
					console.warn(`No model found at ${queryTable}.${queryRow}`)
					return
				}
				if (queryNot ? !result[queryPath] : result[queryPath]) {
					app.actions
						.tick()
						.then(() => {
							console.log("useTick: tick (queryPath)")
						})
						.catch((err) => {
							console.error("useTick: action rejected", err)
						})
				}
			} else if (typeof condition === "boolean" && !condition) {
				console.log("useTick: disabled")
				// do nothing
			} else {
				app.actions
					.tick()
					.then(() => {
						console.log("useTick: tick")
					})
					.catch((err) => {
						console.error("useTick: action rejected", err)
					})
			}
		}, interval)

		return () => {
			console.log("useTick: cleaning up")
			clearInterval(timer)
			// app.removeEventListener("message", tickSynchronizer)
		}
	}, [app, condition, interval])
}
