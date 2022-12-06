export const PEER_ID_FILENAME = "peer.id"
export const SPEC_FILENAME = "spec.canvas.js"
export const MST_FILENAME = "mst.okra"
export const MODEL_DATABASE_FILENAME = "models.sqlite"
export const MESSAGE_DATABASE_FILENAME = "messages.sqlite"

export const BLOCK_CACHE_SIZE = 128
export const RUNTIME_MEMORY_LIMIT = 1024 * 640 // 640kb

export const BOUNDS_CHECK_LOWER_LIMIT = new Date("2020").valueOf()
export const BOUNDS_CHECK_UPPER_LIMIT = new Date("2070").valueOf()

export const ANNOUNCE_DELAY = 1000 * 10
export const ANNOUNCE_INTERVAL = 1000 * 60 * 60 * 1
export const ANNOUNCE_RETRY_INTERVAL = 1000 * 5

export const SYNC_DELAY = 1000 * 15
export const SYNC_INTERVAL = 1000 * 60 * 1
export const SYNC_RETRY_INTERVAL = 1000 * 5
