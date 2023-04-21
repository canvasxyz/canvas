export interface P2PConfig {
	listen?: string[]
	announce?: string[]
	bootstrapList?: string[]

	disableDHT?: boolean
	disablePing?: boolean
	disablePubSub?: boolean
}
