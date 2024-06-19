import type { Canvas } from "@canvas-js/core"
import type { ModelValue, QueryParams } from "@canvas-js/modeldb"
import { useLiveQuery as _useLiveQuery } from "@canvas-js/modeldb-idb"

export function useLiveQuery<T extends ModelValue = ModelValue>(
	app: Canvas | null | undefined,
	modelName: string,
	query: QueryParams = {},
) {
	return _useLiveQuery<T>(app?.db, modelName, query)
}
