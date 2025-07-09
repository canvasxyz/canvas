import { useState, useEffect } from "react"
import { Canvas, ClientSyncStatus } from "@canvas-js/core"

export const useSyncStatus = (app: Canvas | null | undefined) => {
	const [syncStatus, setSyncStatus] = useState<ClientSyncStatus>("offline")
	const [remoteClock, setRemoteClock] = useState<number>(app?.messageLog.getLatestRemoteClock() ?? 0)
	const [localClock, setLocalClock] = useState<number>(0)
	const [progress, setProgress] = useState<number>(0)

	useEffect(() => {
		if (!app) return

		const updateSyncStatus = async () => {
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

		updateSyncStatus()

		app.messageLog.addEventListener("connect", updateSyncStatus)
		app.messageLog.addEventListener("disconnect", updateSyncStatus)
		app.messageLog.addEventListener("sync:status", updateSyncStatus)
		app.messageLog.addEventListener("message", updateSyncStatus)
		app.messageLog.addEventListener("peer:update", updateSyncStatus)

		return () => {
			app.messageLog.removeEventListener("connect", updateSyncStatus)
			app.messageLog.removeEventListener("disconnect", updateSyncStatus)
			app.messageLog.removeEventListener("sync:status", updateSyncStatus)
			app.messageLog.removeEventListener("message", updateSyncStatus)
			app.messageLog.removeEventListener("peer:update", updateSyncStatus)
		}
	}, [app])

	return {
		syncStatus,
		progress,
		localClock,
		remoteClock,
	}
}
