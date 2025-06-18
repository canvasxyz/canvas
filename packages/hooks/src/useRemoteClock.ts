import { useState, useEffect } from "react"
import { Canvas } from "@canvas-js/core"

export const useRemoteClock = (app: Canvas | null | undefined) => {
	const [clock, setClock] = useState<number>(0)
	useEffect(() => {
		if (!app) return

		const updateClock = () => {
			const newClock = app.messageLog.getLatestRemoteClock()
			if (newClock !== undefined) setClock(newClock)
		}
		updateClock()
		app.messageLog.addEventListener("message", updateClock)
		app.messageLog.addEventListener("connect", updateClock)
		app.messageLog.addEventListener("disconnect", updateClock)
		app.messageLog.addEventListener("sync:status", updateClock)
		return () => {
			app.messageLog.removeEventListener("message", updateClock)
			app.messageLog.removeEventListener("connect", updateClock)
			app.messageLog.removeEventListener("disconnect", updateClock)
			app.messageLog.removeEventListener("sync:status", updateClock)
		}
	}, [app])
	return clock
}
