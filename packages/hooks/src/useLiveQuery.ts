import type { Canvas, ModelSchema } from "@canvas-js/core"
import type { QueryParams } from "@canvas-js/modeldb"
import { useLiveQuery as _useLiveQuery } from "@canvas-js/modeldb-idb"

export function useLiveQuery<ModelsT extends ModelSchema, K extends keyof ModelsT & string>(
	app: Canvas<ModelsT> | null | undefined,
	modelName: K,
	query: QueryParams = {},
) {
	return _useLiveQuery<ModelsT, K>(app?.db, modelName, query)
}
