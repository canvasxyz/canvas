import { configure } from "safe-stable-stringify"

/**
 * Use json-stable-stringify for serialization. Turn off special
 * handling for bigints, and throw an error on circular structures.
 */
export const stringify = configure({
	bigint: false,
	circularValue: Error,
	strict: true,
	deterministic: true,
})
