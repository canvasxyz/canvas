import { AccountData } from "@cosmjs/amino"

interface OfflineSigner {
	getAccounts: () => AccountData[]
}

export interface KeplrEthereumSigner {
	signEthereum: (chainId: string, address: string, dataToSign: string, ethSignType: "message") => Promise<Uint8Array>
	getOfflineSigner: (chainId: string) => OfflineSigner
}

export interface EvmMetaMaskSigner {
	eth: {
		personal: { sign: (dataToSign: string, address: string, password: string) => Promise<string> }
		getAccounts: () => Promise<string[]>
	}
}
