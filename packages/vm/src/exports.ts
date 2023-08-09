// import { QuickJSContext, QuickJSHandle } from "quickjs-emscripten"

// import { ModelsInit } from "@canvas-js/modeldb-interface"

// import { unwrapArray, unwrapObject } from "./values.js"
// import { assert } from "./utils.js"

// /**
//  * `Exports` is a simple, direct translation of the module's exports,
//  * equivalent to context.dump(moduleHandle) except it keeps functions
//  * as QuickJSHandle values.
//  */
// export type Exports = {
// 	models: ModelsInit
// 	topics: TopicsInit
// }

// export type TopicsInit = {
// 	topic: string
// 	actions?: Record<string, QuickJSHandle>
// 	apply?: QuickJSHandle
// 	create?: QuickJSHandle
// }[]

// export function disposeExports(exports: Exports) {
// 	for (const topic of Object.values(exports.topics)) {
// 		topic.apply?.dispose()
// 		topic.create?.dispose()
// 		for (const handle of Object.values(topic.actions ?? {})) {
// 			handle.dispose()
// 		}
// 	}
// }

// export type ParseContractResult = { exports: Exports; warnings: string[] }

// // export async function parseContractExports(
// // 	context: QuickJSContext,
// // 	uri: string,
// // 	contract: string
// // ): Promise<ParseContractResult> {
// // 	const warnings: string[] = []

// // 	const moduleHandle = await loadModule(context, uri, contract)
// // 	const {
// // 		models: modelsHandle,
// // 		topics: topicsHandle,
// // 		...rest
// // 	} = moduleHandle.consume((handle) => unwrapObject(context, handle))

// // 	for (const [key, handle] of Object.entries(rest)) {
// // 		warnings.push(`extraneous export: ${JSON.stringify(key)}`)
// // 		handle.dispose()
// // 	}

// // 	const exports: Exports = {
// // 		models: modelsHandle.consume((handle) => unwrapModelsInit(context, handle, warnings)),
// // 		topics: topicsHandle.consume((handle) => unwrapTopicsInit(context, handle, warnings)),
// // 	}

// // 	return { exports, warnings }
// // }

// function unwrapModelsInit(context: QuickJSContext, modelsInitHandle: QuickJSHandle, warnings: string[]): ModelsInit {
// 	// TODO: be better
// 	return context.dump(modelsInitHandle)
// }

// function unwrapTopicsInit(context: QuickJSContext, topicsInitHandle: QuickJSHandle, warnings: string[]): TopicsInit {
// 	const topics: TopicsInit = []

// 	const topicInitHandles = unwrapArray(context, topicsInitHandle)
// 	for (const [i, topicInitHandle] of topicInitHandles.entries()) {
// 		const {
// 			topic: topicHandle,
// 			codec: codecHandle,
// 			actions: actionsHandle,
// 			apply: applyHandle,
// 			create: createHandle,
// 			...rest
// 		} = topicInitHandle.consume((handle) => unwrapObject(context, handle))

// 		for (const [key, handle] of Object.entries(rest)) {
// 			warnings.push(`extraneous property ${JSON.stringify(key)} in topics[${i}]`)
// 			handle.dispose()
// 		}

// 		assert(topicHandle !== undefined, `missing property "topic" in topics[${i}]`)
// 		const topic = topicHandle.consume(context.getString)

// 		if (actionsHandle !== undefined) {
// 			assert(applyHandle === undefined)
// 			assert(createHandle === undefined)
// 			topics.push({ topic, actions: unwrapObject(context, actionsHandle) })
// 		} else {
// 			assert(applyHandle !== undefined)
// 			topics.push({ topic, apply: applyHandle, create: createHandle })
// 		}
// 	}

// 	return topics
// }
