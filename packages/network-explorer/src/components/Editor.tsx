import React, { useEffect, useRef } from "react"

import { EditorState } from "@codemirror/state"
import { EditorView, keymap } from "@codemirror/view"
import { defaultKeymap, indentWithTab } from "@codemirror/commands"
import { indentUnit } from "@codemirror/language"
import { basicSetup } from "codemirror"
import { typescriptLanguage } from "@codemirror/lang-javascript"
import { oneDark } from "@codemirror/theme-one-dark"
import { Compartment } from "@codemirror/state"

import { useCodeMirror } from "../hooks/useCodeMirror.js"
import { useTheme } from "../hooks/useTheme.js"

interface EditorProps {
	initialValue: string
	readOnly?: boolean
	onChange?: (state: EditorState, view: EditorView | null) => void
	onLoad?: (state: EditorState, view: EditorView | null) => void
	onBuild: (state: EditorState, view: EditorView | null) => void
}

export const Editor: React.FC<EditorProps> = ({ initialValue, readOnly, onChange, onLoad, onBuild }) => {
	// TODO: Refactor to avoid passing EditorState through go-around ref.
	const stateRef = useRef<EditorState | null>(null)
	const { theme } = useTheme()
	const themeCompartment = useRef(new Compartment())

	const [state, transaction, viewRef, element] = useCodeMirror<HTMLDivElement>({
		doc: initialValue,
		extensions: [
			keymap.of([
				{
					key: "Mod-Enter",
					run: (view: EditorView) => {
						if (stateRef.current === null) return false
						onBuild(stateRef.current, view)
						return true
					},
				},
			]),
			indentUnit.of("\t"),
			basicSetup,
			keymap.of([indentWithTab]),
			typescriptLanguage,
			keymap.of(defaultKeymap),
			EditorView.editable.of(!(readOnly ?? false)),
			themeCompartment.current.of(theme === "dark" ? oneDark : []),
		],
	})

	useEffect(() => {
		stateRef.current = state
	}, [state])

	useEffect(() => {
		if (onLoad !== undefined && state !== null) {
			onLoad(state, viewRef.current)
		}
	}, [state])

	useEffect(() => {
		if (onChange !== undefined && state !== null) {
			if (transaction === null || transaction.docChanged) {
				onChange(state, viewRef.current)
			}
		}
	}, [state, transaction])

	useEffect(() => {
		if (viewRef.current) {
			viewRef.current.dispatch({
				effects: themeCompartment.current.reconfigure(theme === "dark" ? oneDark : []),
			})
		}
	}, [theme])

	return <div className="editor" ref={element}></div>
}
