import { Handler } from "./Handler.js"

const handler = new Handler()

onmessage = (event) => {
	const result = handler.handle(event.data)
	postMessage(result)
}
