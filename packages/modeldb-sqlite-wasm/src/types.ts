import { Config, QueryParams } from "@canvas-js/modeldb"

type InitializeMessage = {
	type: "initialize"
	config: Config
	dbName: string
}

type GetMessage = {
	type: "get"
	modelName: string
	key: string
}

type IterateMessage = {
	type: "iterate"
	modelName: string
}

type CountMessage = {
	type: "count"
	modelName: string
}

type QueryMessage = {
	type: "query"
	modelName: string
	query: QueryParams
}

export type MessageData = InitializeMessage | GetMessage | IterateMessage | CountMessage | QueryMessage
