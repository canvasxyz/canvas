export interface EvmMetaMaskSigner {
	eth: {
		personal: { sign: (dataToSign: string, address: string, password: string) => Promise<string> }
		getAccounts: () => Promise<string[]>
	}
}
