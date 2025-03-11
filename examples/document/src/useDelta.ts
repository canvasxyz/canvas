import { Canvas, ModelSchema } from "@canvas-js/core"
import { MAX_MESSAGE_ID, MIN_MESSAGE_ID } from "@canvas-js/gossiplog"
import { useLiveQuery } from "@canvas-js/hooks"
import { Op } from "quill"
import { useEffect, useState } from "react"

export const useDelta = <T extends ModelSchema>(
	app: Canvas<T> | undefined,
	modelName: string,
	key: string,
	apply: (deltas: Op[]) => void,
) => {
	const [cursor, setCursor] = useState(`${modelName}/${key}/${MIN_MESSAGE_ID}`)

	// TODO: is there a cleaner way to type calls to `useLiveQuery` that use internal tables?
	const results = useLiveQuery(app as any, "$document_operations", {
		where: { id: { gt: cursor, lt: `${modelName}/${key}/${MAX_MESSAGE_ID}` }, isAppend: false },
	}) as { id: string; key: string; data: Op[] }[] | null

	useEffect(() => {
		if (!results) return
		for (const message of results) {
			const { data } = message
			apply(data)
		}
		// set the cursor to the id of the last item
		if (results.length > 0) setCursor(results[results.length - 1].id)
	}, [results])
}
