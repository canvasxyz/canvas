import React from "react"

import dynamic from "next/dynamic"

import { basicSetup } from "@codemirror/basic-setup"
import { EditorView } from "@codemirror/view"
import { javascriptLanguage } from "@codemirror/lang-javascript"
import { useCodeMirror } from "utils/client/codemirror"

import styles from "./CodeMirror.module.scss"

const extensions = [
	basicSetup,
	javascriptLanguage,
	EditorView.editable.of(false),
]

interface ViewerProps {
	value: string
}

export const Viewer = dynamic(
	async () =>
		function ({ value }: ViewerProps) {
			const [state, transaction, view, element] = useCodeMirror<HTMLDivElement>(
				{ doc: value, extensions }
			)

			return <div className={styles.editor} ref={element}></div>
		},
	{ ssr: false }
)
