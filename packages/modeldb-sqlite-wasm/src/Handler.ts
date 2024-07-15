import { InnerModelDB } from "./InnerModelDB.js"
import { MessageData } from "./types.js"

export class Handler {
	private innerModelDb: InnerModelDB | null = null

	public handle(data: MessageData) {
		const messageType = data.type
		if (messageType == "initialize") {
			this.innerModelDb = new InnerModelDB(data.dbName, data.config)
			// TODO: should initialize return anything?
		} else if (messageType == "get") {
			if (!this.innerModelDb) throw new Error("ModelDB not initialized")
			return this.innerModelDb.get(data.modelName, data.key)
		} else if (messageType == "iterate") {
			if (!this.innerModelDb) throw new Error("ModelDB not initialized")
			// TODO: implement an iterator protocol - maybe we need to store a pool of iterators
			// and let the frontend (oh no) call next on them
			// return await this.innerModelDb.iterate(data.modelName)
		} else if (messageType == "count") {
			if (!this.innerModelDb) throw new Error("ModelDB not initialized")
			return this.innerModelDb.count(data.modelName)
		} else if (messageType == "query") {
			if (!this.innerModelDb) throw new Error("ModelDB not initialized")
			return this.innerModelDb.query(data.modelName, data.query)
		} else {
			throw new Error(`unknown message type: ${messageType}`)
		}
	}
}
