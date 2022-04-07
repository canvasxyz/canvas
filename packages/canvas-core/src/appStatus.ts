import type { Model } from "./models.js"

export type AppStatusStarting = { status: "starting" }
export type AppStatusFailed = { status: "failed"; error: string }
export type AppStatusRunning = {
	status: "running"
	models: Record<string, Model>
	actionParameters: Record<string, string[]>
}

export type AppStatus = AppStatusStarting | AppStatusFailed | AppStatusRunning
