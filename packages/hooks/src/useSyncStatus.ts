import { useState, useEffect } from "react"
import { Canvas, ClientSyncStatus } from "@canvas-js/core"

export const useSyncStatus = (app: Canvas | null | undefined) => {
	const [syncStatus, setSyncStatus] = useState<ClientSyncStatus>("offline")
	const [remoteClock, setRemoteClock] = useState<number>(app?.messageLog.getLatestRemoteClock() ?? 0)
	const [localClock, setLocalClock] = useState<number>(0)
	const [progress, setProgress] = useState<number>(0)

	useEffect(() => {
		if (!app) return

		const updateState = async () => {
			if (syncStatus !== app.syncStatus) {
				setTimeout(() => setSyncStatus(app.syncStatus))
			}

			const newRemoteClock = app.messageLog.getLatestRemoteClock()
			setRemoteClock(newRemoteClock)

			// Sync progress is clamped to 1 because remote clocks aren't updated
			const [newLocalClock, heads] = await app.messageLog.getClock()
			setLocalClock(newLocalClock)

			if (newLocalClock === 0 && newRemoteClock === 0) {
				setProgress(1)
			} else {
				const newProgress = newRemoteClock > 0 ? Math.min(newLocalClock / newRemoteClock, 1) : 0
				setProgress(Math.round(newProgress * 100) / 100)
			}
		}

		updateState()

		app.messageLog.addEventListener("connect", updateState)
		app.messageLog.addEventListener("disconnect", updateState)
		app.messageLog.addEventListener("sync:status", updateState)
		app.messageLog.addEventListener("message", updateState)
		app.messageLog.addEventListener("peer:update", updateState)

		return () => {
			app.messageLog.removeEventListener("connect", updateState)
			app.messageLog.removeEventListener("disconnect", updateState)
			app.messageLog.removeEventListener("sync:status", updateState)
			app.messageLog.removeEventListener("message", updateState)
			app.messageLog.removeEventListener("peer:update", updateState)
		}
	}, [app])

	return {
		syncStatus,
		progress,
		localClock,
		remoteClock,
	}
}
