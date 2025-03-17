import { Canvas } from "@canvas-js/core"
import Quill, { EmitterSource } from "quill"
import "quill/dist/quill.snow.css"
import React, { forwardRef, useEffect, useLayoutEffect, useRef } from "react"

type EditorProps = {
	readOnly: boolean
	defaultValue: any
	onTextChange: (delta: any, oldDelta: any, source: EmitterSource) => void
	onSelectionChange: (delta: any, oldDelta: any, source: EmitterSource) => void
}

// Editor is an uncontrolled React component
export const Editor = forwardRef(({ readOnly, defaultValue, onTextChange, onSelectionChange }: EditorProps, ref) => {
	const containerRef = useRef<HTMLDivElement>(null)
	const defaultValueRef = useRef(defaultValue)
	const onTextChangeRef = useRef(onTextChange)
	const onSelectionChangeRef = useRef(onSelectionChange)

	useLayoutEffect(() => {
		onTextChangeRef.current = onTextChange
		onSelectionChangeRef.current = onSelectionChange
	})

	useEffect(() => {
		// @ts-ignore
		ref.current?.enable(!readOnly)
	}, [ref, readOnly])

	useEffect(() => {
		const container = containerRef.current
		if (!container || !ref) return
		const editorContainer = container.appendChild(container.ownerDocument.createElement("div"))
		const quill = new Quill(editorContainer, {
			theme: "snow",
		})

		// @ts-ignore
		ref.current = quill

		if (defaultValueRef.current) {
			quill.setContents(defaultValueRef.current)
		}

		quill.on(Quill.events.TEXT_CHANGE, (...args) => {
			onTextChangeRef.current?.(...args)
		})

		quill.on(Quill.events.SELECTION_CHANGE, (...args) => {
			onSelectionChangeRef.current?.(...args)
		})

		return () => {
			// @ts-ignore
			ref.current = undefined
			container.innerHTML = ""
		}
	}, [ref])

	return <div ref={containerRef}></div>
})
