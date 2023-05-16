// import { AbstractStore } from "./models"

// export class CentralizedStore implements AbstractStore {
// 	websocket: WebSocket
// 	apply: (key: Uint8Array, value: Uint8Array) => Promise<void>

// 	constructor(websocket: WebSocket, apply: (key: Uint8Array, value: Uint8Array) => Promise<void>) {
// 		this.websocket = websocket
// 		this.apply = apply

// 		// listen for messages
// 		this.websocket.onmessage = (event) => {
// 			const data = JSON.parse(event.data)
// 			console.log(`received ${data}`)
// 			// store everything as hex strings
// 			this.apply(Buffer.from(data.key, "hex"), Buffer.from(data.value, "hex"))
// 		}
// 	}

// 	async insert(key: Uint8Array, value: Uint8Array): Promise<void> {
// 		console.log(`inserting ${key} ${value}`)
// 		// do something with the value like write it to a local store
// 		await this.apply(key, value)

// 		this.websocket.send(
// 			JSON.stringify({
// 				// store everything as hex strings
// 				key: Buffer.from(key).toString("hex"),
// 				value: Buffer.from(value).toString("hex"),
// 			})
// 		)
// 	}

// 	async close(): Promise<void> {
// 		this.websocket.close()
// 	}
// }
