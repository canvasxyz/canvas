export const second = 1000
export const minute = second * 60
export const hour = minute * 60

export const MIN_CONNECTIONS = 2
export const MAX_CONNECTIONS = 10

export const MAX_INBOUND_STREAMS = 64
export const MAX_OUTBOUND_STREAMS = 64

export const MAX_SYNC_QUEUE_SIZE = 8
export const SYNC_COOLDOWN_PERIOD = 20 * second
export const SYNC_RETRY_INTERVAL = 3 * second // this is multiplied by Math.random()
export const SYNC_RETRY_LIMIT = 5
