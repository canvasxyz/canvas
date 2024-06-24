export interface NetworkConfig {
	start?: boolean

	/** array of local WebSocket multiaddrs, e.g. "/ip4/127.0.0.1/tcp/3000/ws" */
	listen?: string[]

	/** array of public WebSocket multiaddrs, e.g. "/dns4/myapp.com/tcp/443/wss" */
	announce?: string[]

	relayServer?: string
	bootstrapList?: string[]
	minConnections?: number
	maxConnections?: number
}
