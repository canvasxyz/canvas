/// <reference types="node" />
import * as t from "io-ts";
/**
 * A `ModelType` is a runtime representation of an abstract model field type,
 * ie string values that we use to set the sqlite schema and coerce
 * action arguments.
 */
export declare type ModelType = "boolean" | "string" | "integer" | "float" | "bytes" | "datetime";
export declare const modelTypeType: t.Type<ModelType>;
/**
 *  A `ModelValue` is a type-level representation of concrete model field types, ie
 * a TypeScript type that describes the possible JavaScript values that instantiate
 * the various ModelType options.
 */
export declare type ModelValue = null | boolean | number | string | Buffer;
export declare const modelValueType: t.UnionC<[t.NullC, t.BooleanC, t.NumberC, t.StringC, t.Type<Buffer, Buffer, unknown>]>;
export declare type Model = Record<string, ModelType>;
export declare function validateType(type: ModelType, value: ModelValue): void;
export declare function getColumnType(type: ModelType): string;
