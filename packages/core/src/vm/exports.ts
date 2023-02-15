import { ContractMetadata, Model } from "@canvas-js/interfaces"

import { QuickJSHandle } from "quickjs-emscripten"

export type CustomActionDefinition = {
	name: string
	schema: any
	fn: QuickJSHandle
}

export type Exports = {
	name: string | null
	actionHandles: Record<string, QuickJSHandle>
	customAction: CustomActionDefinition | null
	contractMetadata: Record<string, ContractMetadata>
	component: string | null
	models: Record<string, Model>
	routeHandles: Record<string, QuickJSHandle>
	sourceHandles: Record<string, Record<string, QuickJSHandle>>
}

export function disposeExports(exports: Exports) {
	for (const handle of Object.values(exports.actionHandles)) {
		handle.dispose()
	}

	if (exports.customAction) {
		exports.customAction.fn.dispose()
	}

	for (const handle of Object.values(exports.routeHandles)) {
		handle.dispose()
	}

	for (const sourceHandlesMap of Object.values(exports.sourceHandles)) {
		for (const handle of Object.values(sourceHandlesMap)) {
			handle.dispose()
		}
	}
}
