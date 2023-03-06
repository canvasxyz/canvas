export * from "./core.js"
export * from "./errors.js"
export * from "./api.js"
export * from "./websockets.js"

import { VM } from "@canvas-js/core/components/vm"
export const validateSpec = (spec: string) => VM.validate(spec)
