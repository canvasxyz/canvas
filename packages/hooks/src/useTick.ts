import { useState, useEffect } from "react"
import type { Canvas, Contract, CanvasLogEvent, ActionImplementation } from "@canvas-js/core"
import type { Action } from "@canvas-js/interfaces"

type TickingContract = Contract & {
	actions: {
		tick: ActionImplementation
	}
}

const tickState = { last: 0 }

export const useTick = (app: Canvas<TickingContract>, condition: string | null, interval: number) => {
	useEffect(() => {
		if (!app) return

		if (condition !== null && typeof condition !== "string") {
			throw new Error("useTick: invalid condition")
		}
		if (typeof interval !== "number") {
			throw new Error("useTick: invalid interval")
		}

		let queryNot: boolean
		let queryTable: string
		let queryRow: string
		let queryPath: string

		if (condition) {
			const matches = condition.match(/^(!)?(\w+)\.(\w+).(\w+)$/)

			if (!matches) {
				throw new Error("useTick: invalid condition, must match model.field or !model.field")
			}

			queryNot = matches[1] === "!"
			queryTable = matches[2]
			queryRow = matches[3]
			queryPath = matches[4]
		}

		const tickListener = async (event: CanvasLogEvent) => {
			const payload = event.detail.message.payload

			if (payload.type === "action") {
				const action = payload as Action

				for (const signer of app.signers) {
					const session = await signer.getSession(app.topic, { fromCache: true })
					if (action.address === session.address) {
						return
					}
				}

				if (action.name === "tick") {
					tickState.last = new Date().getTime()
				}
			}
		}
		app.addEventListener("message", tickListener)

		const timer = setInterval(async () => {
			// don't tick if another tick was received recently
			if (tickState.last > new Date().getTime() - interval) {
				return
			}

			// don't tick if the condition isn't satisfied
			if (condition) {
				const result = await app.db.get(queryTable, queryRow)
				if (!result) {
					throw new Error(`No model found at ${queryTable}.${queryRow}`)
				}
				if (queryNot ? !result[queryPath] : result[queryPath]) {
					app.actions.tick({})
				}
			} else {
				app.actions.tick({}).catch((err) => console.error(err))
			}
		}, interval)

		return () => {
			clearInterval(timer)
			app.removeEventListener("message", tickListener)
		}
	}, [app, condition, interval])
}
