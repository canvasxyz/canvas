export { Core, CoreConfig, CoreOptions } from "./core.js"

import { VM } from "@canvas-js/core/components/vm"
export const validateSpec = (spec: string) => VM.validate(spec)
