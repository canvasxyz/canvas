import React, { useCallback, useEffect, useState } from "react"

import dynamic from "next/dynamic"

import type { EditorState } from "@codemirror/state"
import { keymap } from "@codemirror/view"
import { defaultKeymap, indentWithTab } from "@codemirror/commands"
import { basicSetup } from "@codemirror/basic-setup"
import { indentUnit } from "@codemirror/language"

import { javascriptLanguage } from "@codemirror/lang-javascript"
import { useCodeMirror } from "utils/client/codemirror"

import styles from "./CodeMirror.module.scss"
import { useDebouncedCallback } from "use-debounce"
import { getReasonPhrase, StatusCodes } from "http-status-codes"
import { useRouter } from "next/router"

const extensions = [
	indentUnit.of("  "),
	basicSetup,
	javascriptLanguage,
	keymap.of(defaultKeymap),
	keymap.of([indentWithTab]),
]

interface EditorProps {
	slug: string
	initialValue: string
	latestVersion: number
	matchesPreviousVersion: number
	onSaved: (string) => void
	onEdited: (string) => void
}

export const Editor = dynamic(
	async () =>
		function ({ slug, initialValue, latestVersion, matchesPreviousVersion, onSaved, onEdited }: EditorProps) {
			const [publishing, setPublishing] = useState(false)
			const router = useRouter()

			const publish = useCallback((state: EditorState) => {
				const confirmed = confirm("Publish a new version?")
				if (!confirmed) return

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
						alert("Publishing failed")
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
							onSaved(draft_spec)
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

			const edited = useDebouncedCallback((state: EditorState) => {
				const draft_spec = state.doc.toJSON().join("\n")
				onEdited(draft_spec)
			}, 100)

			const [state, transaction, view, element] = useCodeMirror<HTMLDivElement>({
				doc: initialValue,
				extensions,
			})

			useEffect(() => {
				if (state !== null && transaction !== null && transaction.docChanged) {
					setClean(false)
					saveDraft(state)
					edited(state)
				}
			}, [state, transaction])

			return (
				<div className="flex-1 w-max h-max">
					<div className="flex flex-row place-content-between relative w-full">
						<div className="font-semibold mb-3">&nbsp;</div>
						<div className="absolute top-0 right-0">
							{
								<span className="mr-2 text-sm text-gray-400">
									{matchesPreviousVersion
										? `Saved as v${matchesPreviousVersion}`
										: clean
										? "Up to date"
										: saving
										? "Saving..."
										: "Unsaved changes"}
								</span>
							}
							<button
								className={`text-sm px-2 py-1 ml-1.5 rounded bg-gray-200 hover:bg-gray-300 ${
									publishing || saving || error !== null || !clean || matchesPreviousVersion
										? "cursor-not-allowed pointer-events-none opacity-60"
										: "cursor-pointer"
								}`}
								disabled={publishing || saving || error !== null || !clean || matchesPreviousVersion}
								onClick={() => state && publish(state)}
							>
								{publishing ? <span>Publishing...</span> : <span>Save new version</span>}
							</button>
						</div>
					</div>
					{error && (
						<div>
							⚠️ Error saving spec: <code>{error}</code>
						</div>
					)}
					<div className={styles.editor} ref={element}></div>
				</div>
			)
		},
	{ ssr: false }
)
