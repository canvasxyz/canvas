import { Message, Updates } from "@canvas-js/interfaces"
import { AbstractModelDB, ModelSchema } from "@canvas-js/modeldb"
import * as Y from "yjs"
import { YjsCall } from "./ExecutionContext.js"
import { assert } from "@canvas-js/utils"

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
	private documentIds: Record<string, Record<string, number>> = {}

	public static schema = {
		$document_updates: {
			primary: "primary",
			model: "string",
			key: "string",
			id: "number",
			// applyDelta, insert or delete
			data: "json",
			// yjs document diff
			diff: "bytes",
			isAppend: "boolean",
			$indexes: ["id"],
		},
	} satisfies ModelSchema

	#db: AbstractModelDB | null = null

	public get db() {
		assert(this.#db !== null, "internal error - expected this.#db !== null")
		return this.#db
	}

	public set db(db: AbstractModelDB) {
		this.#db = db
	}

	public getYDoc(model: string, key: string) {
		this.documents[model] ||= {}
		this.documents[model][key] ||= new Y.Doc()
		return this.documents[model][key]
	}

	public async loadSavedDocuments() {
		assert(this.#db !== null, "internal error - expected this.#db !== null")
		// iterate over the past document operations
		// and create the yjs documents
		for await (const operation of this.#db.iterate("$document_updates")) {
			const doc = this.getYDoc(operation.model, operation.key)
			Y.applyUpdate(doc, operation.diff)
			const existingId = this.getId(operation.model, operation.key)
			if (operation.id > existingId) {
				this.setId(operation.model, operation.key, operation.id)
			}
		}
	}

	public getId(model: string, key: string) {
		this.documentIds[model] ||= {}
		return this.documentIds[model][key] ?? -1
	}

	public setId(model: string, key: string, id: number) {
		this.documentIds[model] ||= {}
		this.documentIds[model][key] = id
	}

	public getNextId(model: string, key: string) {
		return this.getId(model, key) + 1
	}

	public async applyYjsCalls(model: string, key: string, calls: YjsCall[]) {
		assert(this.#db !== null, "internal error - expected this.#db !== null")

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

		await this.writeDocumentUpdate(model, key, delta || [], diff, true)

		return { model, key, diff }
	}

	public async consumeUpdatesMessage(message: Message<Updates>) {
		assert(this.#db !== null, "internal error - expected this.#db !== null")

		for (const { model, key, diff } of message.payload.updates) {
			// apply the diff to the doc
			const doc = this.getYDoc(model, key)
			const delta = getDeltaForYText(doc.getText(), () => {
				Y.applyUpdate(doc, diff)
			})

			// save the observed update to the db
			await this.writeDocumentUpdate(model, key, delta, diff, false)
		}
	}

	private async writeDocumentUpdate(model: string, key: string, data: Delta, diff: Uint8Array, isAppend: boolean) {
		assert(this.#db !== null, "internal error - expected this.#db !== null")
		const id = this.getNextId(model, key)
		this.setId(model, key, id)

		await this.#db.set(`$document_updates`, {
			primary: `${model}/${key}/${id}`,
			model,
			key,
			id,
			data,
			diff,
			isAppend,
		})
	}
}
