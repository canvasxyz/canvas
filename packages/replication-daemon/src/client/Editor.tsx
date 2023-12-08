import React, { useEffect } from "react"

import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { javascriptLanguage } from "@codemirror/lang-javascript"
import { basicSetup } from "codemirror"

import { useCodeMirror } from "./useCodeMirror.js"

// const extensions = [indentUnit.of("  "), basicSetup, parser, keymap.of(defaultKeymap)]

export interface EditorProps {
	initialValue?: string
	readOnly?: boolean
	onChange?: (state: EditorState) => void
}

export function Editor({ initialValue, readOnly, onChange }: EditorProps) {
	const [state, transaction, _, element] = useCodeMirror<HTMLDivElement>({
		doc: initialValue,
		extensions: [
			basicSetup,
			javascriptLanguage,
			EditorState.readOnly.of(readOnly ?? false),
			EditorView.editable.of(!readOnly),
		],
	})

	useEffect(() => {
		if (onChange !== undefined && state !== null) {
			if (transaction === null || transaction.docChanged) {
				onChange(state)
			}
		}
	}, [state, transaction])

	return <div className="bg-white border flex" ref={element}></div>
}
