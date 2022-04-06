import type { Model } from "./models"

export type AppStatusStarting = { status: "starting" }
export type AppStatusStopped = { status: "stopped" }
export type AppStatusFailed = { status: "failed"; error: string }
export type AppStatusRunning = {
	status: "running"
	models: Record<string, Model>
	actionParameters: Record<string, string[]>
}

export type AppStatus = AppStatusStarting | AppStatusStopped | AppStatusFailed | AppStatusRunning
