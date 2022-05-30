import React, { useMemo, useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { DownloadIcon } from "@heroicons/react/outline"

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
	onEdited: (arg0: string) => void
}

function Editor({ app, onEdited }: EditorProps) {
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
				toast.error("Could not publish new version")
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
		<div>
			<div className="flex flex-row place-content-between relative w-full">
				<div className="font-semibold mb-3">&nbsp;</div>
				<div className="absolute top-0 right-0">
					<span className="mr-2 text-sm text-gray-400">{clean ? "Saved" : saving ? "Saving..." : "Saving..."}</span>
					<button
						className="text-sm px-2 py-1 ml-1.5 rounded bg-gray-200 hover:bg-gray-300"
						onClick={() => {
							if (state === null) return
							const spec = state.doc.toJSON().join("\n")
							const element = document.createElement("a")
							element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(spec))
							element.setAttribute("download", `${app.slug}.canvas.js`)

							element.style.display = "none"
							document.body.appendChild(element)
							element.click()
							document.body.removeChild(element)
						}}
					>
						<DownloadIcon className="inline -mt-0.5 h-3.5 w-3.5" />
					</button>
					<button
						className={`text-sm px-2 py-1 ml-1.5 rounded bg-gray-200 hover:bg-gray-300 ${
							publishingDisabled ? "cursor-not-allowed pointer-events-none opacity-60" : "cursor-pointer"
						}`}
						disabled={publishingDisabled}
						onClick={() => state && publish(state)}
					>
						{publishing ? (
							<span>Publishing...</span>
						) : matchesPreviousVersion ? (
							<span>Published as v{matchesPreviousVersion}</span>
						) : (
							<span>Publish</span>
						)}
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
}

export const SpecEditor = dynamic(async () => Editor, { ssr: false })
