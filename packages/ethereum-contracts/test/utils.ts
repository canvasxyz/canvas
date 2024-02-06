// These functions are used to serialize data for the contract to consume
// The smart contract doesn't support null as an input value, so we need to
// serialize null values as empty strings or 0 (depending on the type)

export const serializeSessionForContract = (session: any) => {
	return {
		address_: session.address.split(":")[2],
		authorizationData: {
			signature: session.authorizationData.signature,
		},
		blockhash: session.blockhash || "",
		duration: session.duration || 0,
		publicKey: session.publicKey,
		timestamp: session.timestamp,
	}
}

export const serializeActionForContract = async (action: any) => {
	// This file is being built using CommonJS, so we need to use await import to import
	// from ESM modules
	const { getAbiString } = await import("@canvas-js/signed-cid")
	return {
		address_: action.address.split(":")[2],
		args: getAbiString(action.args),
		blockhash: action.blockhash || "",
		name: action.name,
		timestamp: action.timestamp,
	}
}
