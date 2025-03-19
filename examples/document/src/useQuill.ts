import { Canvas } from "@canvas-js/core"
import { AbstractModelDB } from "@canvas-js/modeldb"
import Quill from "quill"
import { useEffect, useRef } from "react"

export const useQuill = ({
	modelName,
	modelKey,
	app,
}: {
	modelName: string
	modelKey: string
	app: Canvas | undefined
}) => {
	const db = app?.db
	const dbRef = useRef<AbstractModelDB | null>(db ?? null)
	const subscriptionRef = useRef<number | null>(null)
	const quillRef = useRef<Quill>()

	const cursorRef = useRef(-1)

	useEffect(() => {
		// Unsubscribe from the cached database handle, if necessary
		if (
			!app ||
			db === null ||
			modelName === null ||
			db === undefined ||
			modelName === undefined ||
			modelKey === undefined
		) {
			if (dbRef.current !== null) {
				if (subscriptionRef.current !== null) {
					dbRef.current.unsubscribe(subscriptionRef.current)
					subscriptionRef.current = null
				}
			}

			dbRef.current = db ?? null
			return
		}

		if (dbRef.current === db && subscriptionRef.current !== null) {
			return
		}

		if (dbRef.current !== null && subscriptionRef.current !== null) {
			db.unsubscribe(subscriptionRef.current)
		}

		// set the initial value
		const initialContents = app.getYDoc(modelName, modelKey).getText().toDelta()
		quillRef.current?.updateContents(initialContents)

		// get the initial value for cursorRef
		const startId = app.getYDocId(modelName, modelKey)
		const query = {
			where: {
				model: modelName,
				key: modelKey,
				isAppend: false,
				id: { gt: startId },
			},
			limit: 1,
			orderBy: { id: "desc" as const },
		}

		const { id } = db.subscribe("$document_updates", query, (results) => {
			for (const result of results) {
				const resultId = result.id as number
				if (cursorRef.current < resultId) {
					cursorRef.current = resultId
					quillRef.current?.updateContents(result.data)
				}
			}
		})
		dbRef.current = db

		subscriptionRef.current = id

		return () => {
			if (dbRef.current !== null && subscriptionRef.current !== null) dbRef.current.unsubscribe(subscriptionRef.current)
			dbRef.current = null
			subscriptionRef.current = null
		}
	}, [(db as any)?.isProxy ? null : db, modelKey, modelName])

	return quillRef
}
