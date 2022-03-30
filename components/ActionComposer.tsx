import React, { useEffect, useCallback, useMemo, useState } from "react"
import { ethers } from "ethers"

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
	"from": "",
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

	const [currentSigner, setCurrentSigner] = useState<any>()
	useEffect(() => {
		const provider = new ethers.providers.Web3Provider((window as any).ethereum)
		if (!provider) {
			// TODO handle error
			return
		}
		provider
			.send("eth_requestAccounts", [])
			.then(() => {
				const signer = provider.getSigner()
				setCurrentSigner(signer)
			})
			.catch(() => {
				// TODO handle error
			})
	}, [])

	const handleClick = useCallback(() => {
		if (state === null) {
			return
		}

		const value = state.doc.toJSON().join("\n")
		let payloadObject
		try {
			payloadObject = JSON.parse(value)
		} catch (e) {
			console.error(value, e)
			alert("Invalid JSON")
			return
		}
		const payloadString = JSON.stringify(payloadObject)

		if (!currentSigner) {
			alert("Signer not ready, try connecting Metamask")
			return
		}

		setSending(true)
		currentSigner
			.signMessage(payloadString)
			.then((result: string) => {
				const action = {
					from: "",
					chainId: "",
					signature: result,
					payload: payloadString,
				}

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
			})
			.catch(() => {
				setSending(false)
				alert("Signature rejected")
			})
	}, [state, currentSigner])

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
