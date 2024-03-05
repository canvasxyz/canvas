export const toCAIP = (address: string) => {
	return "eip155:1:" + address
}
export const fromCAIP = (address: string) => {
	return address.replace("eip155:1:", "")
}