import { useState, useEffect } from "react"
import { Canvas, ClientSyncStatus } from "@canvas-js/core"

export const useSyncStatus = (app: Canvas | null | undefined) => {
	const [syncStatus, setSyncStatus] = useState<ClientSyncStatus>("offline")
	useEffect(() => {
		if (!app) return
		const updateSyncStatus = () => {
			setTimeout(() => setSyncStatus(app.syncStatus))
		}
		app.messageLog.addEventListener("connect", updateSyncStatus)
		app.messageLog.addEventListener("disconnect", updateSyncStatus)
		app.messageLog.addEventListener("sync:status", updateSyncStatus)
		return () => {
			app.messageLog.removeEventListener("connect", updateSyncStatus)
			app.messageLog.removeEventListener("disconnect", updateSyncStatus)
			app.messageLog.removeEventListener("sync:status", updateSyncStatus)
		}
	}, [app])
	return syncStatus
}
