import React, { useEffect } from "react"

import type { EditorState } from "@codemirror/state"
import { EditorView, keymap } from "@codemirror/view"
import { defaultKeymap, indentWithTab } from "@codemirror/commands"
import { indentUnit } from "@codemirror/language"
import { basicSetup } from "codemirror"

import { typescriptLanguage } from "@codemirror/lang-javascript"

import { useCodeMirror } from "../hooks/useCodeMirror.js"

const getExtensions = (readOnly: boolean) => [
	indentUnit.of("\t"),
	basicSetup,
	keymap.of([indentWithTab]),
	typescriptLanguage,
	keymap.of(defaultKeymap),
	EditorView.editable.of(!readOnly),
]

interface EditorProps {
	initialValue: string
	readOnly?: boolean
	onChange?: (state: EditorState) => void
}

/** use state.doc.toString() to get content out of the onChange callback */
export const Editor: React.FC<EditorProps> = ({ initialValue, readOnly, onChange }) => {
	const [state, transaction, _, element] = useCodeMirror<HTMLDivElement>({
		doc: initialValue,
		extensions: getExtensions(readOnly ?? false),
	})

	useEffect(() => {
		if (onChange !== undefined && state !== null) {
			if (transaction === null || transaction.docChanged) {
				onChange(state)
			}
		}
	}, [state, transaction])

	return <div className="editor" ref={element}></div>
}
