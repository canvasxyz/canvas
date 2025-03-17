import { Canvas } from "@canvas-js/core"
import { MAX_MESSAGE_ID, MIN_MESSAGE_ID } from "@canvas-js/gossiplog"
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
	// db: AbstractModelDB | undefined
	app: Canvas | undefined
}) => {
	const db = app?.db
	const dbRef = useRef<AbstractModelDB | null>(db ?? null)
	const subscriptionRef = useRef<number | null>(null)
	const quillRef = useRef<Quill>()

	const seenCursorsRef = useRef(new Set<string>())

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
			console.log("exit1")
			return
		}

		if (dbRef.current === db && subscriptionRef.current !== null) {
			console.log("exit2")
			return
		}

		if (dbRef.current !== null && subscriptionRef.current !== null) {
			db.unsubscribe(subscriptionRef.current)
		}

		// set the initial value
		const initialContents = app.getYDoc(modelName, modelKey).getText().toDelta()
		quillRef.current?.updateContents(initialContents)

		const query = {
			where: {
				id: { gt: `${modelName}/${modelKey}/${MIN_MESSAGE_ID}`, lt: `${modelName}/${modelKey}/${MAX_MESSAGE_ID}` },
				isAppend: false,
			},
		}
		const { id } = db.subscribe("$document_operations", query, (results) => {
			for (const result of results) {
				const resultId = result.id as string
				if (!seenCursorsRef.current.has(resultId)) {
					console.log(result.data)
					seenCursorsRef.current.add(resultId)
					quillRef.current?.updateContents(result.data)
				}
			}
		})
		dbRef.current = db

		subscriptionRef.current = id

		console.log("subscribed to", modelName, modelKey, id)
		return () => {
			if (dbRef.current !== null && subscriptionRef.current !== null) dbRef.current.unsubscribe(subscriptionRef.current)
			dbRef.current = null
			subscriptionRef.current = null
		}
	}, [(db as any)?.isProxy ? null : db, modelKey, modelName])

	return quillRef
}
