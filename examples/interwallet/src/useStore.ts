// decentralised approach:
// context object could have a single Libp2p object
// this is then used to create a number of Store objects
// also have some objects that store the data locally, using the `apply` function

import { useEffect, useState } from "react"
import { AbstractStore } from "./models"
// import { CentralizedStore } from "./centralizedStore"

// centralised approach
// the "Store" object just connects to a centralised server that stores the data
// long polling or websockets could be used to get updates
// insert could be a POST request or a websocket message
// local storage is the same as above

const connectWebsocket = async (websocket: WebSocket) =>
	new Promise<WebSocket>((resolve, reject) => {
		websocket.onopen = () => {
			resolve(websocket)
		}

		websocket.onerror = (err) => {
			websocket.close()
			reject(err)
		}
	})

export const useStore = (url: string, apply: (key: Uint8Array, value: Uint8Array) => Promise<void>) => {
	const [websocket, setWebsocket] = useState<WebSocket | null>(null)
	const [isConnected, setIsConnected] = useState(false)

	const [store, setStore] = useState<AbstractStore | null>(null)

	useEffect(() => {
		setWebsocket(new WebSocket(url))
	}, [url])

	useEffect(() => {
		if (!websocket) return
		if (isConnected) return
		connectWebsocket(websocket).then((websocket) => {
			setIsConnected(true)
		})
	}, [websocket])

	useEffect(() => {
		if (!isConnected) return
		if (!websocket) return

		// setStore(new CentralizedStore(websocket, apply))
	}, [isConnected])

	return { store }
}
