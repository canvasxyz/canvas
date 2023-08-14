import { ActionContext } from "@canvas-js/interfaces"

export const getActionContext = (topic: string): ActionContext => ({
	topic,
	timestamp: Date.now(),
	blockhash: null,
	// depth: 0,
	// dependencies: [],
})
