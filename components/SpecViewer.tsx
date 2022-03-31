import React from "react"

import dynamic from "next/dynamic"

import { basicSetup } from "@codemirror/basic-setup"
import { EditorView } from "@codemirror/view"
import { javascriptLanguage } from "@codemirror/lang-javascript"
import { useCodeMirror } from "utils/client/codemirror"

import styles from "./CodeMirror.module.scss"

const extensions = [basicSetup, javascriptLanguage, EditorView.editable.of(false)]

interface ViewerProps {
	spec: string
	version_number: number
}

export const Viewer = dynamic(
	async () =>
		function Viewer({ spec, version_number }: ViewerProps) {
			const [state, transaction, view, element] = useCodeMirror<HTMLDivElement>({ doc: spec, extensions })

			return (
				<div>
					<div className="flex flex-row place-content-between relative w-full">
						<div className="font-semibold mb-3">&nbsp;</div>
						<div className="text-gray-400 text-sm pt-1">Read-only · Saved as v{version_number}</div>
					</div>
					<div className={styles.editor} ref={element}></div>
				</div>
			)
		},
	{ ssr: false }
)
