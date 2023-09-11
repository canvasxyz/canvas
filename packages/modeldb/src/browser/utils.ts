export const getObjectStoreName = (model: string) => `record/${model}`
export const getTombstoneObjectStoreName = (model: string) => `tombstone/${model}`
export const getIndexName = (index: string[]) => index.join("/")
