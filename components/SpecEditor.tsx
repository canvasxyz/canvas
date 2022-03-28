import React, { useMemo, useCallback, useEffect, useState } from "react"

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
	app: {
		slug: string
		draft_spec: string
		versions: {
			multihash: string
			version_number: number
			spec: string
		}[]
	}
	onEdited: (string) => void
}

export const Editor = dynamic(
	async () =>
		function ({ app, onEdited }: EditorProps) {
			const [publishing, setPublishing] = useState(false)
			const router = useRouter()

			const publish = useCallback((state: EditorState) => {
				const confirmed = confirm("Publish a new version?")
				if (!confirmed) {
					return
				}

				setPublishing(true)
				const spec = state.doc.toJSON().join("\n")
				fetch(`/api/app/${app.slug}`, {
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

			const [lastSavedValue, setLastSavedValue] = useState(app.draft_spec)
			const matchesPreviousVersion = useMemo<null | number>(() => {
				const version = app.versions.find((version) => version.spec === lastSavedValue)
				return version === undefined ? null : version.version_number
			}, [lastSavedValue])

			const saveDraft = useDebouncedCallback(
				(state: EditorState) => {
					setSaving(true)
					const draft_spec = state.doc.toJSON().join("\n")
					fetch(`/api/app/${app.slug}`, {
						method: "PUT",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ draft_spec }),
					}).then((res) => {
						setSaving(false)
						if (res.status === StatusCodes.OK) {
							setClean(true)
							setError(null)
							setLastSavedValue(draft_spec)
						} else {
							setError(getReasonPhrase(res.status))
						}
					})
				},
				1000,
				{ maxWait: 5000 }
			)

			const [state, transaction, view, element] = useCodeMirror<HTMLDivElement>({ doc: app.draft_spec, extensions })

			useEffect(() => {
				if (state !== null && transaction !== null && transaction.docChanged) {
					setClean(false)
					saveDraft(state)
				}
			}, [state, transaction])

			const publishingDisabled = publishing || saving || error !== null || !clean || matchesPreviousVersion !== null

			return (
				<div className="flex-1 w-max h-max">
					<div className="flex flex-row place-content-between relative w-full">
						<div className="font-semibold mb-3">&nbsp;</div>
						<div className="absolute top-0 right-0">
							<span className="mr-2 text-sm text-gray-400">
								{matchesPreviousVersion
									? `Identical to v${matchesPreviousVersion}`
									: clean
									? "Saved as draft"
									: saving
									? "Saving as draft..."
									: "Saving as draft..."}
							</span>
							<button
								className={`text-sm px-2 py-1 ml-1.5 rounded bg-gray-200 hover:bg-gray-300 ${
									publishingDisabled ? "cursor-not-allowed pointer-events-none opacity-60" : "cursor-pointer"
								}`}
								disabled={publishingDisabled}
								onClick={() => state && publish(state)}
							>
								{publishing ? <span>Publishing...</span> : <span>Publish</span>}
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
