import type { Canvas } from "@canvas-js/core"
import type { ModelSchema, ModelValue, QueryParams } from "@canvas-js/modeldb"
import { useLiveQuery as _useLiveQuery } from "@canvas-js/modeldb-idb"

export function useLiveQuery<M extends ModelSchema & Record<string, ModelValue>, K extends keyof M & string>(
	app: Canvas<M> | null | undefined,
	modelName: K,
	query: QueryParams = {},
) {
	return _useLiveQuery<M[K]>(app?.db, modelName, query)
}
