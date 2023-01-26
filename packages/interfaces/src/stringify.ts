import { configure } from "safe-stable-stringify"

export const stringify = configure({
	bigint: false,
	circularValue: Error,
	strict: true,
	deterministic: true,
})
