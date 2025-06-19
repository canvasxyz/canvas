import { useState, useEffect } from "react"
import { Canvas } from "@canvas-js/core"

export const useRemoteClock = (app: Canvas | null | undefined) => {
	const [clock, setClock] = useState<number>(app?.messageLog.getLatestRemoteClock() ?? 0)

	useEffect(() => {
		if (app === null || app === undefined) {
			return
		}

		const updateClock = () => setClock(app.messageLog.getLatestRemoteClock())

		updateClock()
		app.messageLog.addEventListener("message", updateClock)
		app.messageLog.addEventListener("peer:update", updateClock)

		return () => {
			app.messageLog.removeEventListener("message", updateClock)
			app.messageLog.removeEventListener("peer:update", updateClock)
		}
	}, [app])

	return clock
}
