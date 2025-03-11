import { Message, Updates } from "@canvas-js/interfaces"
import { AbstractModelDB, ModelSchema } from "@canvas-js/modeldb"
import * as Y from "yjs"
import { YjsCall } from "./ExecutionContext.js"

type Delta = Y.YTextEvent["changes"]["delta"]

function getDeltaForYText(ytext: Y.Text, fn: () => void): Delta {
	let delta: Delta | null = null

	const handler = (event: Y.YTextEvent) => {
		delta = event.changes.delta
	}

	ytext.observe(handler)
	fn()
	ytext.unobserve(handler)
	return delta || []
}

export class DocumentStore {
	private documents: Record<string, Record<string, Y.Doc>> = {}

	public static schema = {
		$document_operations: {
			// ${model}/${key}/${messageId}
			id: "primary",
			// applyDelta, insert or delete
			data: "json",
			// yjs document diff
			diff: "bytes",
			isAppend: "boolean",
		},
	} satisfies ModelSchema

	public getYDoc(model: string, key: string) {
		this.documents[model] ||= {}
		this.documents[model][key] ||= new Y.Doc()
		return this.documents[model][key]
	}

	public async loadSavedDocuments(db: AbstractModelDB) {
		// iterate over the past document operations
		// and create the yjs documents
		for await (const operation of db.iterate("$document_operations")) {
			const [model, key, _messageId] = operation.id.split("/")
			const doc = this.getYDoc(model, key)
			Y.applyUpdate(doc, operation.diff)
		}
	}

	public async applyYjsCalls(db: AbstractModelDB, model: string, key: string, messageId: string, calls: YjsCall[]) {
		const doc = this.getYDoc(model, key)

		// get the initial state of the document
		const beforeState = Y.encodeStateAsUpdate(doc)

		const delta = getDeltaForYText(doc.getText(), () => {
			for (const call of calls) {
				if (call.call === "insert") {
					doc.getText().insert(call.index, call.content)
				} else if (call.call === "delete") {
					doc.getText().delete(call.index, call.length)
				} else if (call.call === "applyDelta") {
					// TODO: do we actually need to call sanitize here?
					doc.getText().applyDelta(call.delta.ops, { sanitize: true })
				} else {
					throw new Error("unexpected call type")
				}
			}
		})

		// diff the document with the initial state
		const afterState = Y.encodeStateAsUpdate(doc)
		const diff = Y.diffUpdate(afterState, Y.encodeStateVectorFromUpdate(beforeState))

		await db.set(`$document_operations`, {
			id: `${model}/${key}/${messageId}`,
			key,
			data: delta || [],
			diff,
			isAppend: true,
		})

		return { model, key, diff }
	}

	public async consumeUpdatesMessage(db: AbstractModelDB, message: Message<Updates>, id: string) {
		for (const { model, key, diff } of message.payload.updates) {
			// apply the diff to the doc
			const doc = this.getYDoc(model, key)
			const delta = getDeltaForYText(doc.getText(), () => {
				Y.applyUpdate(doc, diff)
			})

			// save the observed update to the db
			await db.set(`$document_operations`, {
				id: `${model}/${key}/${id}`,
				key,
				data: delta,
				diff,
				isAppend: false,
			})
		}
	}
}
