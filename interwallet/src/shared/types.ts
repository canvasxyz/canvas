export type EventMap = {
	message: { content: string; timestamp: number; sender: string }
}

export type RoomEvent = {
	[Type in keyof EventMap]: { room: string; type: Type; detail: EventMap[Type] }
}[keyof EventMap]

export type KeyBundle = {
	signingPublicKey: `0x${string}`
	encryptionPublicKey: `0x${string}`
}

// this corresponds to the fields exposed by the PublicRoomRegistration class,
// but is only used for defining database schemas
type PublicRoomRegistration = {
	address: `0x${string}`
	keyBundle: KeyBundle
	keyBundleSignature: `0x${string}`
}

export type Room = {
	id: string
	creator: `0x${string}`
	members: PublicRoomRegistration[]
}

export interface PrivateUserRegistration extends PublicRoomRegistration {
	encryptionPrivateKey: `0x${string}`
	signingPrivateKey: `0x${string}`
}
