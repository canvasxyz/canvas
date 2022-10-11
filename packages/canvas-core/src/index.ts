// having an empty import for fp-ts fixes this bug
// https://github.com/microsoft/TypeScript/issues/48075
import "fp-ts"

export * from "./core.js"
export * from "./vm/index.js"
export * from "./model-store/index.js"
export * from "./message-store/index.js"
export * from "./codecs.js"
export * from "./errors.js"
export * from "./encoding.js"
export { compileSpec } from "./utils.js"
