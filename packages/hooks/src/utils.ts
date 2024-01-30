export const ethAddressToCAIP = (address: string) => {
	return "eip155:1:" + address
}

export const caipToEthAddress = (address: string) => {
	return address.replace("eip155:1:", "")
}

export const getGroupId = (address1: string, address2: string) => {
	return address1 < address2 ? `${address1},${address2}` : `${address1},${address2}`
}
