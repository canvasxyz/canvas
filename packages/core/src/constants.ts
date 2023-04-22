export const PEER_ID_FILENAME = "peer.id"
export const SPEC_FILENAME = "spec.canvas.js"
export const MST_DIRECTORY_NAME = "mst"
export const MODEL_DATABASE_FILENAME = "models.sqlite"
export const MESSAGE_DATABASE_FILENAME = "messages.sqlite"

export const BLOCK_CACHE_SIZE = 128
export const RUNTIME_MEMORY_LIMIT = 1024 * 640 // 640kb

export const BOUNDS_CHECK_LOWER_LIMIT = new Date("2020").valueOf()
export const BOUNDS_CHECK_UPPER_LIMIT = new Date("2070").valueOf()

export const second = 1000
export const minute = second * 60
export const hour = minute * 60

export const PEER_DISCOVERY_TOPIC = "/canvas/discovery"
export const PEER_DISCOVERY_INTERVAL = 5 * second

// don't sync with any one peer more often than this
export const SYNC_COOLDOWN_PERIOD = 30 * second

export const PING_INTERVAL = 5 * minute
export const DIAL_TIMEOUT = 20 * second
export const PING_TIMEOUT = 10 * second

export const MIN_CONNECTIONS = 5
export const MAX_CONNECTIONS = 300

export const DIAL_CONCURRENCY = 10
export const DIAL_CONCURRENCY_PER_PEER = 3
