import React, { useEffect, useCallback, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { ethers } from "ethers"

import dynamic from "next/dynamic"

import { keymap } from "@codemirror/view"
import { defaultKeymap, indentWithTab } from "@codemirror/commands"
import { basicSetup } from "@codemirror/basic-setup"
import { indentUnit } from "@codemirror/language"

import { jsonLanguage } from "@codemirror/lang-json"
import { useCodeMirror } from "utils/client/codemirror"
import { ActionPayload, AppData, ActionParams } from "utils/server/types"

import styles from "./ActionComposer.module.scss"
import { StatusCodes } from "http-status-codes"

const extensions = [indentUnit.of("  "), basicSetup, jsonLanguage, keymap.of(defaultKeymap), keymap.of([indentWithTab])]

const getInitialActionValue = (call: string, args: string[], from = "") => `{
	"from": "${from}",
	"call": "${call}",
	"args": [${args.length ? '"<' : ""}${args.join('>", "<')}${args.length ? '>"' : ""}],
	"timestamp": ${new Date().valueOf()}
}`

function ActionComposer(props: { appData: AppData; multihash: string }) {
	const [sending, setSending] = useState(false)

	const [state, transaction, view, element] = useCodeMirror<HTMLDivElement>({
		doc: getInitialActionValue("", []),
		extensions,
	})

	const setEditorValue = useCallback(
		(value: string) => {
			if (view.current !== null && state !== null) {
				const t = state.update({
					changes: { from: 0, to: state?.doc.length, insert: value },
				})
				view.current.dispatch(t)
			}
		},
		[state]
	)

	const [currentSigner, setCurrentSigner] = useState<any>()
	const [currentAddress, setCurrentAddress] = useState<string>()
	useEffect(() => {
		if (state === null) return
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
				signer.getAddress().then((address) => {
					setCurrentAddress(address)
					setEditorValue(getInitialActionValue("", [], address))
				})
			})
			.catch(() => {
				toast.error("Wallet did not return an address")
			})
	}, [state === null])

	const handleClick = useCallback(() => {
		if (state === null) {
			return
		}
		const value = state.doc.toJSON().join("\n")
		let payloadObject: ActionPayload
		try {
			payloadObject = JSON.parse(value)
		} catch (e) {
			console.error(value, e)
			toast.error("Invalid JSON")
			return
		}
		const payloadString = JSON.stringify(payloadObject)

		if (!currentSigner) {
			toast.error("Signer not ready. Have you connected Metamask?")
			return
		}

		setSending(true)
		currentSigner
			.signMessage(payloadString)
			.then((result: string) => {
				const action = {
					from: payloadObject.from,
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
						toast.success("Action sent!")
					} else {
						toast.error("Action evaluation failed")
					}
				})
			})
			.catch(() => {
				setSending(false)
				toast.error("Signature rejected")
			})
	}, [state, currentSigner])

	return (
		<div className="mt-2">
			<div className="mb-3">
				{props.appData.actions.map(([call, args]: ActionParams) => (
					<div
						className="inline-block text-sm px-2 py-0.5 mb-1 mr-1.5 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
						onClick={() => {
							setEditorValue(getInitialActionValue(call, args, currentAddress))
						}}
					>
						{call}
					</div>
				))}
			</div>
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
