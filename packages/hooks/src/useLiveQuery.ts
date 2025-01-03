import type { Canvas } from "@canvas-js/core"
import type { ModelValue, QueryParams, ModelSchema } from "@canvas-js/modeldb"
import { useLiveQuery as _useLiveQuery } from "@canvas-js/modeldb-idb"

export function useLiveQuery<Schema extends ModelSchema, K extends keyof ModelSchema>(
	app: Canvas | null | undefined,
	modelName: string,
	query: QueryParams = {},
) {
	return _useLiveQuery<Schema, K>(app?.db, modelName, query)
}
