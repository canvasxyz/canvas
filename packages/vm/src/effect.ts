// import { QuickJSContext, QuickJSHandle } from "quickjs-emscripten"

// import { AbstractModelDB, ModelValue, getImmutableRecordKey, validateModelValue } from "@canvas-js/modeldb-interface"

// import { assert, signalInvalidType } from "./utils.js"
// import { wrapAPI, wrapObject } from "./values.js"

// export type Effect =
// 	| { model: string; operation: "add"; key: string; value: ModelValue }
// 	| { model: string; operation: "set"; key: string; value: ModelValue }
// 	| { model: string; operation: "delete"; key: string }

// export function getDatabaseAPI(
// 	context: QuickJSContext,
// 	db: AbstractModelDB,
// 	namespace: string,
// 	effects: Effect[]
// ): QuickJSHandle {
// 	const modelHandles: Record<string, QuickJSHandle> = {}

// 	for (const model of db.config.models) {
// 		if (model.kind === "mutable") {
// 			modelHandles[model.name] = wrapAPI(context, {
// 				set: (key, value) => {
// 					assert(typeof key === "string", "key argument must be a string")
// 					assert(typeof value === "object", "value argument must be an object")
// 					const modelValue = value as ModelValue
// 					validateModelValue(model, modelValue)
// 					effects.push({ model: model.name, operation: "set", key, value: modelValue })
// 				},
// 				delete: (key) => {
// 					assert(typeof key === "string", "key argument must be a string")
// 					effects.push({ model: model.name, operation: "delete", key })
// 				},
// 			})
// 		} else if (model.kind === "immutable") {
// 			modelHandles[model.name] = wrapAPI(context, {
// 				add: (value) => {
// 					assert(typeof value === "object", "value argument must be an object")
// 					const modelValue = value as ModelValue
// 					validateModelValue(model, modelValue)
// 					const key = getImmutableRecordKey(modelValue, { namespace })
// 					effects.push({ model: model.name, operation: "add", key, value: modelValue })
// 					return key
// 				},
// 				get: (key) => {
// 					assert(typeof key === "string", "key argument must be a string")
// 					return db.get(model.name, key)
// 				},
// 			})
// 		} else {
// 			signalInvalidType(model.kind)
// 		}
// 	}

// 	return wrapObject(context, modelHandles)
// }
