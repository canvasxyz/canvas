import React, { useEffect, useCallback, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { ethers } from "ethers"
import type { TypedDataSigner } from "@ethersproject/abstract-signer"

import dynamic from "next/dynamic"
import { StatusCodes } from "http-status-codes"

import { keymap } from "@codemirror/view"
import { defaultKeymap, indentWithTab } from "@codemirror/commands"
import { basicSetup } from "@codemirror/basic-setup"
import { indentUnit } from "@codemirror/language"
import { jsonLanguage } from "@codemirror/lang-json"

import type { Action, ActionPayload, Session, SessionPayload } from "@canvas-js/core"
import { getActionSignatureData, getSessionSignatureData } from "@canvas-js/core/lib/signers.js"

import { SessionsTable } from "components/SessionsTable"

import { useCodeMirror } from "utils/client/codemirror"

import styles from "./ActionComposer.module.scss"

declare global {
	var ethereum: ethers.providers.ExternalProvider
}

const extensions = [indentUnit.of("  "), basicSetup, jsonLanguage, keymap.of(defaultKeymap), keymap.of([indentWithTab])]

const getInitialActionValue = (multihash: string, call: string, args: string[], from?: string | null) => `{
	"spec": "${multihash}",
	"from": "${from ?? ""}",
	"call": "${call}",
	"args": [${args.map((arg) => `"${arg}"`).join(", ")}],
	"timestamp": ${Math.round(new Date().valueOf() / 1000)}
}`

function ActionComposer(props: { multihash: string; actionParameters: Record<string, string[]> }) {
	const [sendingSignedAction, setSendingSignedAction] = useState(false)
	const [sendingSessionAction, setSendingSessionAction] = useState(false)
	const [generatingSession, setGeneratingSession] = useState(false)

	const [sessionAddress, setSessionPublicKey] = useState<string | null>(null)
	const [sessionSigner, setSessionSigner] = useState<ethers.Wallet | null>(null)

	const [state, transaction, view, element] = useCodeMirror<HTMLDivElement>({
		doc: getInitialActionValue(props.multihash, "", []),
		extensions,
	})

	const setEditorValue = useCallback((value: string) => {
		if (view.current !== null) {
			const { state, dispatch } = view.current
			dispatch(
				state.update({
					changes: { from: 0, to: state.doc.length, insert: value },
				})
			)
		}
	}, [])

	// initialize a signer, and get wallet address
	const [currentSigner, setCurrentSigner] = useState<ethers.providers.JsonRpcSigner | null>(null)
	const [currentAddress, setCurrentAddress] = useState<string | null>(null)

	useEffect(() => {
		if (state === null) {
			return
		}

		const provider = new ethers.providers.Web3Provider(window.ethereum)
		if (!provider) {
			// TODO handle error
			return
		}

		provider
			.send("eth_requestAccounts", [])
			.then(() => {
				const signer = provider.getSigner()
				signer.getAddress().then((address) => {
					setCurrentSigner(signer)
					setCurrentAddress(address)
					setEditorValue(getInitialActionValue(props.multihash, "", [], address))
				})
			})
			.catch(() => {
				toast.error("Wallet did not return an address")
			})
	}, [state === null])

	// if (view.current === null) {
	// 	return
	// } else if (sessionPrivateKey === null) {
	// 	toast.error("Private key not found in localStorage! Try generating a new session key.")
	// 	return
	// }

	// const sessionSigner = new ethers.Wallet(sessionPrivateKey)
	// const signatureData = getActionSignatureData(actionPayload)
	// const signature = await sessionSigner._signTypedData(...signatureData)
	// const action: Action = {
	// 	session: sessionSigner.address,
	// 	signature: signature,
	// 	payload: actionPayload,
	// }

	const sendAction = useCallback(async (signer: TypedDataSigner, session: string | null) => {
		if (view.current === null) {
			return
		}

		const value = view.current.state.doc.toJSON().join("\n")
		let actionPayload: ActionPayload
		try {
			actionPayload = JSON.parse(value)
		} catch (e) {
			console.error(value, e)
			toast.error("Invalid JSON")
			return
		}

		const signatureData = getActionSignatureData(actionPayload)
		const signature = await signer._signTypedData(...signatureData)
		const action: Action = {
			session: session,
			signature: signature,
			payload: actionPayload,
		}

		const res = await fetch(`/api/instance/${props.multihash}/actions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(action),
		})

		if (res.status === StatusCodes.OK) {
			toast.success("Action accepted!")
		} else {
			const err = await res.text()
			toast.error(`Action rejected: ${err}`)
		}
	}, [])

	/**
	 * Sign and send an action
	 */
	const handleSendSignedAction = useCallback(async () => {
		if (currentSigner !== null && currentAddress !== null) {
			setSendingSignedAction(true)
			await sendAction(currentSigner, null)
			setSendingSignedAction(false)
		}
	}, [currentSigner, currentAddress])

	/**
	 * Sign and send an action using the selected session
	 */
	const handleSendSessionAction = useCallback(async () => {
		if (sessionSigner !== null && sessionAddress !== null) {
			setSendingSessionAction(true)
			await sendAction(sessionSigner, sessionAddress)
			setSendingSessionAction(false)
		}
	}, [sessionSigner, sessionAddress])

	/**
	 * Generate new session key
	 */
	const handleGenerateSession = useCallback(async () => {
		if (currentSigner === null || currentAddress === null) {
			toast.error("Signer not ready. Have you connected Metamask?")
			return
		}

		const timestamp = Math.round(Date.now() / 1000)
		const sessionSigner = ethers.Wallet.createRandom()
		localStorage.setItem(sessionSigner.address, sessionSigner.privateKey) // store private key in localStorage

		const sessionPayload: SessionPayload = {
			from: currentAddress,
			spec: props.multihash,
			timestamp,
			session_public_key: sessionSigner.address,
			session_duration: 24 * 60 * 60,
		}

		setGeneratingSession(true)
		const signatureData = getSessionSignatureData(sessionPayload)
		let signature: string
		try {
			signature = await currentSigner._signTypedData(...signatureData)
		} catch (e) {
			console.error(e)
			toast.error("Signature rejected")
			return
		}

		const session: Session = {
			signature: signature,
			payload: sessionPayload,
		}

		const res = await fetch(`/api/instance/${props.multihash}/sessions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(session),
		})

		setGeneratingSession(false)
		if (res.status === StatusCodes.OK) {
			toast.success("Session saved!")
		} else {
			const err = res.text()
			toast.error(`Session rejected: ${err}`)
		}
	}, [currentSigner])

	const handleSessionSelect = useCallback((publicKey: string) => {
		const privateKey = localStorage.getItem(publicKey)
		if (privateKey !== null) {
			setSessionPublicKey(publicKey)
			setSessionSigner(new ethers.Wallet(privateKey))
		} else {
			setSessionPublicKey(null)
			setSessionSigner(null)
			toast.error("Private key not found in localStorage! Try generating a new session key.")
			return
		}
	}, [])

	const handleSelectActionCall = useCallback(
		(call: string) => {
			const parameters = props.actionParameters[call]
			const value = getInitialActionValue(props.multihash, call, parameters, currentAddress)
			setEditorValue(value)
		},
		[props.multihash, currentAddress]
	)

	return (
		<div className="mt-2 mb-4">
			<div className="mb-3">
				{Object.keys(props.actionParameters).map((call) => (
					<div
						key={call}
						className="inline-block text-sm px-2 py-0.5 mb-1 mr-1.5 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
						onClick={() => handleSelectActionCall(call)}
					>
						{call}
					</div>
				))}
			</div>
			<div className={styles.editor} ref={element}></div>
			<button
				className={`mt-3 mr-2 p-2 rounded bg-blue-500 hover:bg-blue-500 font-semibold text-sm text-center text-white ${
					!currentAddress || sendingSignedAction ? "pointer-events-none opacity-50" : ""
				}`}
				disabled={!currentAddress || sendingSignedAction}
				onClick={handleSendSignedAction}
			>
				{sendingSignedAction ? "Signing..." : "Sign and send"}
			</button>
			<div className="mt-4">
				<SessionsTable multihash={props.multihash} onSelect={handleSessionSelect} />
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
					!sessionAddress || sendingSessionAction ? "pointer-events-none opacity-50" : ""
				}`}
				disabled={!sessionAddress || sendingSessionAction}
				onClick={handleSendSessionAction}
			>
				{sendingSessionAction ? "Sending..." : "Send"}
			</button>
		</div>
	)
}

export default dynamic(async () => ActionComposer)
