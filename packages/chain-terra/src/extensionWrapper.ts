import { ActionPayload, serializeActionPayload, serializeSessionPayload, SessionPayload } from "@canvas-js/interfaces"

type TerraAddress = {
	address: string
}

interface TerraExtension {
	isAvailable: boolean
	signBytes: ({ bytes }: { bytes: Uint8Array }) => void
	on: (eventName: "onSign", fn: (payload: { result: any }) => void) => void
	once: (eventName: "onConnect", fn: (payload: TerraAddress) => void) => void
	connect: () => void
}

export class TerraExtensionWrapper {
	constructor(public readonly _extension: TerraExtension) {}

	getAccount() {
		return new Promise<TerraAddress>((resolve) => {
			this._extension.once("onConnect", resolve)
			this._extension.connect()
		})
	}

	signBytes(bytesToSign: Uint8Array) {
		return new Promise<any>((resolve, reject) => {
			this._extension.on("onSign", (terraSignPayload) => {
				if (terraSignPayload.result?.signature) resolve(terraSignPayload.result)
				else reject()
			})
			try {
				this._extension.signBytes({
					bytes: bytesToSign,
				})
			} catch (error) {
				console.error(error)
			}
		})
	}
}
