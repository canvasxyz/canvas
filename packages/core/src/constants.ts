export const PEER_ID_FILENAME = "peer.id"
export const SPEC_FILENAME = "spec.canvas.js"
export const MST_DIRECTORY_NAME = "mst"
export const MODEL_DATABASE_FILENAME = "models.sqlite"
export const MESSAGE_DATABASE_FILENAME = "messages.sqlite"

export const BLOCK_CACHE_SIZE = 128
export const RUNTIME_MEMORY_LIMIT = 1024 * 640 // 640kb

export const BOUNDS_CHECK_LOWER_LIMIT = new Date("2020").valueOf()
export const BOUNDS_CHECK_UPPER_LIMIT = new Date("2070").valueOf()

const second = 1000
const minute = second * 60
const hour = minute * 60

export const DHT_PING_INTERVAL = 5 * minute

export const ANNOUNCE_DELAY = 20 * second
export const ANNOUNCE_INTERVAL = 1 * hour
export const ANNOUNCE_TIMEOUT = 30 * second
export const ANNOUNCE_RETRY_INTERVAL = 5 * second

export const SYNC_DELAY = 5 * second
export const SYNC_INTERVAL = 1 * minute
export const SYNC_RETRY_INTERVAL = 5 * second
export const FIND_PEERS_TIMEOUT = 30 * second
export const DIAL_PEER_TIMEOUT = 10 * second
