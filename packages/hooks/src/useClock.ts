import { useState, useEffect } from "react"
import { Canvas } from "@canvas-js/core"

export const useClock = (app: Canvas | null | undefined) => {
	const [clock, setClock] = useState<number>(0)
	useEffect(() => {
		if (!app) return
		const updateClock = () => {
			app.messageLog.getClock().then(([nextClock, heads]: [number, string[]]) => {
				if (nextClock - 1 > clock) setClock(nextClock - 1)
			})
		}
		updateClock()
		app.messageLog.addEventListener("message", updateClock)
		app.messageLog.addEventListener("sync", updateClock)
		app.messageLog.addEventListener("sync:status", updateClock)
		return () => {
			app.messageLog.removeEventListener("message", updateClock)
			app.messageLog.removeEventListener("sync", updateClock)
			app.messageLog.removeEventListener("sync:status", updateClock)
		}
	}, [app])
	return clock
}
