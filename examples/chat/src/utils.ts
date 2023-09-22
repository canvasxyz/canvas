import { SessionStore } from "@canvas-js/interfaces"

export const location = "chat"

const getKey = (topic: string, chain: string, address: string) => `canvas:${topic}/${chain}:${address}`
export const sessionStore: SessionStore = {
	save: (topic, chain, address, privateSessionData) =>
		window.localStorage.setItem(getKey(topic, chain, address), privateSessionData),
	load: (topic, chain, address) => window.localStorage.getItem(getKey(topic, chain, address)),
}
