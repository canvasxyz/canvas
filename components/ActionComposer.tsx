import React, { useCallback, useMemo, useState } from "react"

import dynamic from "next/dynamic"

import { keymap } from "@codemirror/view"
import { defaultKeymap, indentWithTab } from "@codemirror/commands"
import { basicSetup } from "@codemirror/basic-setup"
import { indentUnit } from "@codemirror/language"

import { jsonLanguage } from "@codemirror/lang-json"
import { useCodeMirror } from "utils/client/codemirror"

import styles from "./ActionComposer.module.scss"
import { StatusCodes } from "http-status-codes"

const extensions = [indentUnit.of("  "), basicSetup, jsonLanguage, keymap.of(defaultKeymap), keymap.of([indentWithTab])]

const getInitialActionValue = () => `{
	"from": null,
	"name": "thread",
	"args": ["this is the title", "http://example.com"],
	"timestamp": ${new Date().valueOf()}
}`

function ActionComposer(props: { multihash: string }) {
	const [sending, setSending] = useState(false)

	const [state, transaction, view, element] = useCodeMirror<HTMLDivElement>({
		doc: getInitialActionValue(),
		extensions,
	})

	const handleClick = useCallback(() => {
		if (state === null) {
			return
		}

		const value = state.doc.toJSON().join("\n")
		let action
		try {
			action = JSON.parse(value)
		} catch (e) {
			console.error(value, e)
			alert("Invalid JSON")
			return
		}

		setSending(true)
		fetch(`/api/instance/${props.multihash}/actions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(action),
		}).then((res) => {
			setSending(false)
			if (res.status === StatusCodes.OK) {
				alert("Action sent successfully!")
			} else {
				alert("Action evaluation failed")
			}
		})
	}, [state])

	return (
		<div className="mt-4">
			<div className={styles.editor} ref={element}></div>
			<button
				className={`mt-2 block p-2 rounded bg-blue-500 hover:bg-blue-500 font-semibold text-sm text-center text-white ${
					sending || state === null ? "pointer-events-none opacity-50" : ""
				}`}
				disabled={sending || state === null}
				onClick={handleClick}
			>
				{sending ? "Sending..." : "Send"}
			</button>
		</div>
	)
}

export default dynamic(async () => ActionComposer)
