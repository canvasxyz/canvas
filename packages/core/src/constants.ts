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

export const DHT_ANNOUNCE_DELAY = 15 * second
export const DHT_ANNOUNCE_INTERVAL = 10 * minute
export const DHT_ANNOUNCE_TIMEOUT = 30 * second
export const DHT_ANNOUNCE_RETRY_INTERVAL = 10 * second

export const DHT_DISCOVERY_DELAY = 10 * second
export const DHT_DISCOVERY_INTERVAL = 2 * minute
export const DHT_DISCOVERY_TIMEOUT = 30 * second
export const DHT_DISCOVERY_RETRY_INTERVAL = 5 * second

export const PUBSUB_DISCOVERY_TOPIC = "/canvas/discovery"
// export const PUBSUB_DISCOVERY_REFRESH_INTERVAL = 10 * second
export const PUSUB_ANNOUNCE_INTERVAL = 30 * second
// export const PUBSUB_DISCOVERY_REFRESH_DELAY = 5 * second
export const PUBSUB_ANNOUNCE_DELAY = 10 * second
export const PUBSUB_ANNOUNCE_RETRY_INTERVAL = 5 * second

// don't sync with any one peer more often than this
export const SYNC_COOLDOWN_PERIOD = 20 * second

export const DIAL_TIMEOUT = 10 * second
export const PING_TIMEOUT = 10 * second

export const MAX_PING_QUEUE_SIZE = 30

export const MIN_CONNECTIONS = 5
export const MAX_CONNECTIONS = 300

export const DIAL_CONCURRENCY = 10
export const DIAL_CONCURRENCY_PER_PEER = 1
