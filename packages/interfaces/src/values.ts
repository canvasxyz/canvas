// import type { CID } from "multiformats/cid"

export type JSONPrimitive = null | boolean | number | string
export type JSONValue<Primitive = JSONPrimitive> = Primitive | JSONArray<Primitive> | JSONObject<Primitive>
export interface JSONArray<Primitive = JSONPrimitive> extends Array<JSONValue<Primitive>> {}
export interface JSONObject<Primitive = JSONPrimitive> {
	[key: string]: JSONValue<Primitive>
}

// export type IPLDValue = JSONValue<null | boolean | number | string | Uint8Array | CID>

// export type JSONPrimitive = null | boolean | number | string
// export type JSONValue = JSONPrimitive | JSONArray | JSONObject
// export interface JSONArray extends Array<JSONValue> {}
// export interface JSONObject {
// 	[key: string]: JSONValue
// }

// export type IPLDPrimitive = null | boolean | number | string | Uint8Array | CID
// export type IPLDValue = IPLDPrimitive | IPLDArray | IPLDObject
// export interface IPLDArray extends Array<IPLDValue> {}
// export interface IPLDObject {
// 	[key: string]: IPLDValue
// }
