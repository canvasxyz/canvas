import React from "react"

import { basicSetup } from "@codemirror/basic-setup"
import { EditorState } from "@codemirror/state"
import { javascriptLanguage } from "@codemirror/lang-javascript"
import { useCodeMirror } from "utils/client/codemirror"

import styles from "./SpecViewer.module.scss"

const extensions = [
	basicSetup,
	javascriptLanguage,
	EditorState.readOnly.of(true),
]

interface ViewerProps {
	value: string
}

export function Viewer({ value }: ViewerProps) {
	const [state, transaction, view, element] = useCodeMirror<HTMLDivElement>({
		doc: value,
		extensions,
	})

	return <div className={styles.viewer} ref={element}></div>
}
