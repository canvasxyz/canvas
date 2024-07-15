import { MessageData } from "./types.js"
import { Handler } from "./Handler.js"

const handler = new Handler()

onmessage = (event: MessageEvent<MessageData>) => {
	const result = handler.handle(event.data)
	postMessage(result)
}
