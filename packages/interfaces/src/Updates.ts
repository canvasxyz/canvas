type Update = {
	model: string
	key: string
	diff: Uint8Array
}

export type Updates = {
	type: "updates"
	updates: Update[]
}
