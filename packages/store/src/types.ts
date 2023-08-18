import type { CID } from "multiformats/cid"

export type IPLDValue = IPLDPrimitive | IPLDArray | IPLDObject
export type IPLDPrimitive = null | boolean | number | string | Uint8Array | CID
export interface IPLDArray extends Array<IPLDValue> {}
export interface IPLDObject {
	[key: string]: IPLDValue
}
