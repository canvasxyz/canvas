import React, { useEffect, useCallback, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { ethers } from "ethers"

import dynamic from "next/dynamic"
import { StatusCodes } from "http-status-codes"

import { keymap } from "@codemirror/view"
import { defaultKeymap, indentWithTab } from "@codemirror/commands"
import { basicSetup } from "@codemirror/basic-setup"
import { indentUnit } from "@codemirror/language"
import { jsonLanguage } from "@codemirror/lang-json"

import Sessions from "components/SpecSessions"

import { useCodeMirror } from "utils/client/codemirror"

import type { Action, ActionPayload, SessionPayload } from "canvas-core"

import styles from "./ActionComposer.module.scss"

const extensions = [indentUnit.of("  "), basicSetup, jsonLanguage, keymap.of(defaultKeymap), keymap.of([indentWithTab])]

const getInitialActionValue = (multihash: string, call: string, args: string[], from = "") => `{
	"spec": "${multihash}",
	"from": "${from}",
	"call": "${call}",
	"args": [${args.map((arg) => `"${arg}"`).join(", ")}],
	"timestamp": ${Math.round(new Date().valueOf() / 1000)}
}`

function ActionComposer(props: { multihash: string; actionParameters: Record<string, string[]> }) {
	const [sendingSignedAction, setSendingSignedAction] = useState(false)
	const [sendingSessionAction, setSendingSessionAction] = useState(false)
	const [generatingSession, setGeneratingSession] = useState(false)
	const [sessionPublicKey, setSessionPublicKey] = useState<string>()
	const [sessionPrivateKey, setSessionPrivateKey] = useState<string>()

	const [state, transaction, view, element] = useCodeMirror<HTMLDivElement>({
		doc: getInitialActionValue(props.multihash, "", []),
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

	// initialize a signer, and get wallet address
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
					setEditorValue(getInitialActionValue(props.multihash, "", [], address))
				})
			})
			.catch(() => {
				toast.error("Wallet did not return an address")
			})
	}, [state === null])

	/**
	 * Sign with session key
	 */
	const handleSendSessionAction = useCallback(() => {
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

		if (!sessionPrivateKey) {
			toast.error("Private key not found in localStorage! Try generating a new session key.")
			return
		}

		const sessionSigner = new ethers.Wallet(sessionPrivateKey)

		setSendingSessionAction(true)
		sessionSigner
			.signMessage(payloadString)
			.then((result: string) => {
				const action: Action = {
					from: payloadObject.from,
					session: sessionSigner.address,
					signature: result,
					payload: payloadString,
				}

				fetch(`/api/instance/${props.multihash}/actions`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(action),
				}).then((res) => {
					setSendingSessionAction(false)
					if (res.status === StatusCodes.OK) {
						toast.success("Action sent!")
					} else {
						res.text().then((err) => {
							toast.error(`Action rejected: ${err}`)
						})
					}
				})
			})
			.catch(() => {
				setSendingSessionAction(false)
				toast.error("Signature rejected")
			})
	}, [state, sessionPublicKey])

	/**
	 * Sign without session key
	 */
	const handleSendAction = useCallback(() => {
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

		setSendingSignedAction(true)
		currentSigner
			.signMessage(payloadString)
			.then((result: string) => {
				const action: Action = {
					from: payloadObject.from,
					session: null,
					signature: result,
					payload: payloadString,
				}

				fetch(`/api/instance/${props.multihash}/actions`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(action),
				}).then((res) => {
					setSendingSignedAction(false)
					if (res.status === StatusCodes.OK) {
						toast.success("Action sent!")
					} else {
						res.text().then((err) => {
							toast.error(`Action rejected: ${err}`)
						})
					}
				})
			})
			.catch(() => {
				setSendingSignedAction(false)
				toast.error("Signature rejected")
			})
	}, [state, currentSigner])

	/**
	 * Generate new session key
	 */
	const handleGenerateSession = useCallback(() => {
		if (state === null) {
			return
		}
		if (!currentSigner || currentAddress === undefined) {
			toast.error("Signer not ready. Have you connected Metamask?")
			return
		}
		const timestamp = Math.round(+new Date() / 1000)
		const sessionSigner = ethers.Wallet.createRandom()
		localStorage.setItem(sessionSigner.address, sessionSigner.privateKey) // store private key in localStorage

		const payloadObject: SessionPayload = {
			from: currentAddress,
			spec: props.multihash,
			timestamp,
			session_public_key: sessionSigner.address,
			session_duration: 24 * 60 * 60,
		}
		const payload = JSON.stringify(payloadObject)

		setGeneratingSession(true)
		currentSigner
			.signMessage(payload)
			.then((result: string) => {
				setGeneratingSession(false)

				const sessionAction: Action = {
					from: payloadObject.from,
					session: null,
					signature: result,
					payload,
				}

				fetch(`/api/instance/${props.multihash}/sessions`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(sessionAction),
				}).then((res) => {
					setGeneratingSession(false)
					if (res.status === StatusCodes.OK) {
						toast.success("Session saved!")
					} else {
						res.text().then((err) => {
							toast.error(`Session rejected: ${err}`)
						})
					}
				})
			})
			.catch(() => {
				setGeneratingSession(false)
				toast.error("Signature rejected")
			})
	}, [state, currentSigner])

	return (
		<div className="mt-2 mb-4">
			<div className="mb-3">
				{Object.entries(props.actionParameters).map(([call, parameters]) => (
					<div
						key={call}
						className="inline-block text-sm px-2 py-0.5 mb-1 mr-1.5 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
						onClick={() => {
							setEditorValue(getInitialActionValue(props.multihash, call, parameters, currentAddress))
						}}
					>
						{call}
					</div>
				))}
			</div>
			<div className={styles.editor} ref={element}></div>
			<button
				className={`mt-3 mr-2 p-2 rounded bg-blue-500 hover:bg-blue-500 font-semibold text-sm text-center text-white ${
					sendingSignedAction || state === null ? "pointer-events-none opacity-50" : ""
				}`}
				disabled={sendingSignedAction || state === null}
				onClick={handleSendAction}
			>
				{sendingSignedAction ? "Signing..." : "Sign and send"}
			</button>
			<div className="mt-4">
				<Sessions
					multihash={props.multihash}
					onSelect={(session_public_key: string) => {
						setSessionPublicKey(session_public_key)
						const privateKey = localStorage.getItem(session_public_key)
						if (privateKey !== undefined && privateKey !== null) {
							setSessionPrivateKey(privateKey)
						}
					}}
				/>
			</div>
			<button
				className={`mt-3 mr-2 p-2 rounded bg-blue-500 hover:bg-blue-500 font-semibold text-sm text-center text-white ${
					generatingSession || state === null ? "pointer-events-none opacity-50" : ""
				}`}
				disabled={generatingSession || state === null}
				onClick={handleGenerateSession}
			>
				{generatingSession ? "Generating session..." : "Generate session"}
			</button>
			<button
				className={`mt-3 mr-2 p-2 rounded bg-blue-500 hover:bg-blue-500 font-semibold text-sm text-center text-white ${
					!sessionPrivateKey || sendingSessionAction || state === null ? "pointer-events-none opacity-50" : ""
				}`}
				disabled={!sessionPrivateKey || sendingSessionAction || state === null}
				onClick={handleSendSessionAction}
			>
				{sendingSessionAction ? "Sending..." : "Send"}
			</button>
		</div>
	)
}

export default dynamic(async () => ActionComposer)
