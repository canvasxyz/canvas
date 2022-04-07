import assert from "node:assert";
import * as t from "io-ts";
export const modelTypeType = t.union([
    t.literal("boolean"),
    t.literal("string"),
    t.literal("integer"),
    t.literal("float"),
    t.literal("bytes"),
    t.literal("datetime"),
]);
const bufferType = new t.Type("Buffer", Buffer.isBuffer, (i, context) => (Buffer.isBuffer(i) ? t.success(i) : t.failure(i, context)), t.identity);
export const modelValueType = t.union([t.null, t.boolean, t.number, t.string, bufferType]);
export function validateType(type, value) {
    if (type === "boolean") {
        assert(typeof value === "boolean", "invalid type: expected boolean");
    }
    else if (type === "string") {
        assert(typeof value === "string", "invalid type: expected string");
    }
    else if (type === "integer") {
        assert(Number.isSafeInteger(value), "invalid type: expected integer");
    }
    else if (type === "float") {
        assert(typeof value === "number", "invalid type: expected number");
    }
    else if (type === "bytes") {
        assert(value instanceof Uint8Array, "invalid type: expected Uint8Array");
    }
    else if (type === "datetime") {
        assert(typeof value === "number", "invalid type: expected number");
    }
    else {
        console.error(type);
        throw new Error("invalid model type");
    }
}
export function getColumnType(type) {
    switch (type) {
        case "boolean":
            return "INTEGER";
        case "string":
            return "TEXT";
        case "integer":
            return "INTEGER";
        case "float":
            return "FLOAT";
        case "bytes":
            return "BLOB";
        case "datetime":
            return "INTEGER";
        default:
            console.error(type);
            throw new Error("invalid model type");
    }
}
