export type KeyBundle = {
	signingAddress: `0x${string}`
	encryptionPublicKey: `0x${string}`
}

export interface PublicUserRegistration {
	address: `0x${string}`
	keyBundle: KeyBundle
}

export interface PrivateUserRegistration {
	privateKey: `0x${string}`
	keyBundle: KeyBundle
	keyBundleSignature: `0x${string}`
}

export type RoomId = `interwallet:room:${string}`

export type Room = {
	topic: RoomId
	members: [`0x${string}`, `0x${string}`]
}

export type Message = {
	room: string
	sender: string
	message: string
	timestamp: number
}

export type EventMap = {
	message: Message
}

type MessageEvent = {
	type: "message"
	detail: Message
}
