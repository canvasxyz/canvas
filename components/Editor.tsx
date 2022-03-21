import React, { useEffect } from "react"

import type { EditorState } from "@codemirror/state"
import { keymap } from "@codemirror/view"
import { defaultKeymap } from "@codemirror/commands"
import { basicSetup } from "@codemirror/basic-setup"
import { indentUnit } from "@codemirror/language"

import { javascriptLanguage } from "@codemirror/lang-javascript"
import { useCodeMirror } from "utils/client/codemirror"

const extensions = [
	indentUnit.of("  "),
	basicSetup,
	javascriptLanguage,
	keymap.of(defaultKeymap),
]

interface EditorProps {
	initialValue: string
	onChange?: (state: EditorState) => void
}

export function Editor({ initialValue, onChange }: EditorProps) {
	const [state, transaction, _, element] = useCodeMirror<HTMLDivElement>({
		doc: initialValue,
		extensions,
	})

	useEffect(() => {
		if (onChange !== undefined && state !== null) {
			if (transaction === null || transaction.docChanged) {
				onChange(state)
			}
		}
	}, [state, transaction])

	return <div ref={element}></div>
}
