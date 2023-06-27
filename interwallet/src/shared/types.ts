export type EventMap = {
	message: { content: string }
}

export type RoomEvent = {
	[Type in keyof EventMap]: { type: Type; roomId: string; timestamp: number; detail: EventMap[Type] }
}[keyof EventMap]

export type KeyBundle = {
	signingPublicKey: `0x${string}`
	encryptionPublicKey: `0x${string}`
}

export type RoomRegistration = {
	creator: `0x${string}`
	members: PublicUserRegistration[]
}

export type Room = { id: string } & RoomRegistration

export interface PublicUserRegistration {
	address: `0x${string}`
	keyBundle: KeyBundle
	keyBundleSignature: `0x${string}`
}

export interface PrivateUserRegistration extends PublicUserRegistration {
	encryptionPrivateKey: `0x${string}`
	signingPrivateKey: `0x${string}`
}
