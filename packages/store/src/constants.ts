export const second = 1000
export const minute = second * 60
export const hour = minute * 60

export const MIN_CONNECTIONS = 5
export const MAX_CONNECTIONS = 300

export const DIAL_TIMEOUT = 10 * second
export const PING_TIMEOUT = 10 * second

export const DISCOVERY_TOPIC = "/canvas/v0/discovery"
export const DISCOVERY_ANNOUNCE_DELAY = 5 * second
export const DISCOVERY_ANNOUNCE_INTERVAL = 2 * minute
export const DISCOVERY_ANNOUNCE_RETRY_INTERVAL = 5 * second

export const SYNC_DELAY = 10 * second
export const SYNC_INTERVAL = 5 * minute
export const SYNC_RETRY_INTERVAL = 10 * second
export const SYNC_COOLDOWN_PERIOD = 2 * minute
export const MAX_SYNC_QUEUE_SIZE = 10

export const PING_DELAY = 1 * minute
export const PING_INTERVAL = 2 * minute
export const PING_RETRY_INTERVAL = 5 * second

export const DIAL_CONCURRENCY = 10
export const DIAL_CONCURRENCY_PER_PEER = 1

export const MIN_TOPIC_PEERS = 5
