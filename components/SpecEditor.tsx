import React, { useCallback, useEffect, useState } from "react"

import type { EditorState } from "@codemirror/state"
import { keymap } from "@codemirror/view"
import { defaultKeymap } from "@codemirror/commands"
import { basicSetup } from "@codemirror/basic-setup"
import { indentUnit } from "@codemirror/language"

import { javascriptLanguage } from "@codemirror/lang-javascript"
import { useCodeMirror } from "utils/client/codemirror"

import styles from "./SpecEditor.module.scss"
import { useDebouncedCallback } from "use-debounce"
import { getReasonPhrase, StatusCodes } from "http-status-codes"
import { useRouter } from "next/router"

const extensions = [
	indentUnit.of("  "),
	basicSetup,
	javascriptLanguage,
	keymap.of(defaultKeymap),
]

interface EditorProps {
	slug: string
	initialValue: string
}

export function Editor({ slug, initialValue }: EditorProps) {
	const [publishing, setPublishing] = useState(false)
	const router = useRouter()

	const publish = useCallback((state: EditorState) => {
		setPublishing(true)
		const spec = state.doc.toJSON().join("\n")
		fetch(`/api/app/${slug}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ spec }),
		}).then((res) => {
			setPublishing(false)
			if (res.status === StatusCodes.CREATED) {
				const location = res.headers.get("Location")
				if (location !== null) {
					router.push(location)
				}
			} else {
				alert("Failed to publish version")
			}
		})
	}, [])

	const [saving, setSaving] = useState(false)
	const [clean, setClean] = useState(true)
	const [error, setError] = useState<null | string>(null)

	const saveDraft = useDebouncedCallback(
		(state: EditorState) => {
			setSaving(true)
			const draft_spec = state.doc.toJSON().join("\n")
			fetch(`/api/app/${slug}`, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ draft_spec }),
			}).then((res) => {
				setSaving(false)
				if (res.status === StatusCodes.OK) {
					setClean(true)
					setError(null)
				} else {
					setError(getReasonPhrase(res.status))
				}
			})
		},
		1000,
		{ maxWait: 5000 }
	)

	const [state, transaction, view, element] = useCodeMirror<HTMLDivElement>({
		doc: initialValue,
		extensions,
	})

	useEffect(() => {
		if (state !== null && transaction !== null && transaction.docChanged) {
			setClean(false)
			saveDraft(state)
		}
	}, [state, transaction])

	return (
		<div className="w-max h-max">
			<div className={styles.editor} ref={element}></div>
			<div className="my-2 flex flex-row place-content-between">
				<button
					className={
						publishing || saving || clean
							? "p-2 rounded bg-gray-200 text-center cursor-not-allowed"
							: "p-2 rounded bg-pink-200 text-center cursor-pointer"
					}
					disabled={publishing || saving || clean}
					onClick={() => state && saveDraft(state)}
				>
					{saving ? (
						<span>⏳ Saving...</span>
					) : clean ? (
						<span>✅ Saved</span>
					) : (
						<span>💾 Save</span>
					)}
				</button>
				<button
					className={
						publishing || saving || error !== null || !clean
							? "p-2 rounded bg-gray-200 text-center cursor-not-allowed"
							: "p-2 rounded bg-pink-200 text-center cursor-pointer"
					}
					disabled={publishing || saving || error !== null || !clean}
					onClick={() => state && publish(state)}
				>
					{publishing ? <span>Publishing...</span> : <span>Publish</span>}
				</button>
			</div>
			{error && (
				<div>
					⚠️ Error saving spec: <code>{error}</code>
				</div>
			)}
		</div>
	)
}
