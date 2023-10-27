export type Message<Payload = unknown> = {
	topic: string
	clock: number
	parents: string[]
	payload: Payload
}
