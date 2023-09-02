export type Message<Payload = unknown> = {
	clock: number
	parents: string[]
	payload: Payload
}
