import type { ActionArgument, ActionPayload, ActionToken } from "./actions.js"
import type { SessionPayload, SessionToken } from "./sessions.js"

// JSON.stringify has lossy behavior on the number values +/-Infinity, NaN, and -0.
// We never actually parse these serialized arguments anywhere - the only purpose here
// is to map them injectively to strings for signing.
function serializeActionArgument(arg: ActionArgument): string {
	if (typeof arg === "number") {
		if (isNaN(arg)) {
			return "NaN"
		} else if (Object.is(arg, -0)) {
			return "-0"
		} else if (arg === Infinity) {
			return "Infinity"
		} else if (arg === -Infinity) {
			return "-Infinity"
		} else {
			return arg.toString()
		}
	} else {
		return JSON.stringify(arg)
	}
}
const namePattern = /^[a-zA-Z][a-zA-Z0-9_]*$/

export function makeActionToken(payload: ActionPayload): ActionToken {
	const keys = Object.keys(payload.args).sort()
	const params = keys.map((key) => {
		if (namePattern.test(key)) {
			return `${key}: ${serializeActionArgument(payload.args[key])}`
		} else {
			throw new Error("invalid argument name")
		}
	})

	return {
		sendAction: payload.call,
		params: params,
		application: payload.spec,
		timestamp: payload.timestamp.toString(),
	}
}

export function makeSessionToken(payload: SessionPayload): SessionToken {
	return {
		loginTo: payload.spec,
		registerSessionAddress: payload.address.toLowerCase(),
		registerSessionDuration: payload.duration.toString(),
		timestamp: payload.timestamp.toString(),
	}
}
