import { Config } from "@canvas-js/modeldb"

type InitializeMessage = {
	type: "initialize"
	config: Config
}

type GetMessage = {
	type: "get"
	modelName: string
	key: string
}

export type MessageData = InitializeMessage | GetMessage
