export type JSONValue = null | string | number | boolean | JSONArray | JSONObject

export interface JSONArray extends Array<JSONValue> {}

export interface JSONObject {
	[key: string]: JSONValue
}
