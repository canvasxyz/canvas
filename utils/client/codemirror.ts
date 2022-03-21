import {
	MutableRefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react"

import {
	EditorState,
	Transaction,
	Extension,
	Text,
	EditorStateConfig,
} from "@codemirror/state"

import { EditorView } from "@codemirror/view"

export interface CodeMirrorOptions {
	doc?: string | Text
	extensions?: Extension
}

export function useCodeMirror<T extends Element>(
	config?: EditorStateConfig
): [
	EditorState | null,
	Transaction | null,
	MutableRefObject<EditorView | null>,
	MutableRefObject<T | null>
] {
	const element = useRef<T | null>(null)
	const view = useRef<EditorView | null>(null)

	const dispatch = useCallback((transaction: Transaction) => {
		if (view.current !== null) {
			view.current.update([transaction])
			setState(view.current.state)
			setTransaction(transaction)
		}
	}, [])

	const [state, setState] = useState<EditorState | null>(null)
	const [transaction, setTransaction] = useState<Transaction | null>(null)

	useEffect(() => {
		if (element.current !== null) {
			const state = EditorState.create(config)
			view.current = new EditorView({
				state,
				dispatch,
				parent: element.current,
			})
			setState(state)
		}
	}, [])

	return [state, transaction, view, element]
}
