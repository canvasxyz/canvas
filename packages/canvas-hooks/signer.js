import { utils } from "ethers"

export const getActionSignaturePayload = (originAddress, multihash, timestamp, call, args) => {
	const domain = {
		name: "Canvas",
		salt: utils.zeroPad(utils.arrayify(originAddress), 32),
	}

	const actionTypes = {
		Message: [
			{ name: "sendAction", type: "string" },
			{ name: "params", type: "string[]" },
			{ name: "application", type: "string" },
			{ name: "timestamp", type: "uint256" },
		],
	}

	const actionValue = {
		sendAction: "createThread",
		params: ["hi", "ho"],
		application: "QmWae75Ak3b1ZsgFeYxEw3tYSHBmuN97EY7oEVjYZPrFuh",
		timestamp: "10",
	}
	return [domain, actionTypes, actionValue]
}

export const getSessionSignaturePayload = (
	originAddress,
	multihash,
	timestamp,
	sessionSignerAddress,
	sessionDuration
) => {
	const domain = {
		name: "Canvas",
		salt: utils.zeroPad(utils.arrayify(originAddress), 32),
	}

	const sessionTypes = {
		Message: [
			{ name: "loginTo", type: "string" },
			{ name: "registerSessionKey", type: "string" },
			{ name: "registerSessionDuration", type: "uint256" },
			{ name: "timestamp", type: "uint256" },
		],
	}

	const sessionValue = {
		loginTo: "QmWae75Ak3b1ZsgFeYxEw3tYSHBmuN97EY7oEVjYZPrFuh",
		registerSessionKey: sessionSignerAddress,
		registerSessionDuration: sessionDuration.toString(),
		timestamp: timestamp.toString(),
	}

	return [domain, sessionTypes, sessionValue]
}
