import React, { useCallback, useContext, useState } from "react"
import { deleteDB } from "idb"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"

import { AppContext } from "./AppContext.js"

export interface ControlPanelProps {}

export const ControlPanel: React.FC<ControlPanelProps> = ({}) => {
	const { app, sessionSigner } = useContext(AppContext)

	const [isStarted, setIsStarted] = useState(false)

	const start = useCallback(async () => {
		if (app !== null) {
			try {
				await app.libp2p.start()
				setIsStarted(true)
			} catch (err) {
				console.error(err)
			}
		}
	}, [app])

	const stop = useCallback(async () => {
		if (app === null) {
			return
		}
		try {
			await app.libp2p.stop()
			setIsStarted(false)
		} catch (err) {
			console.error(err)
		}
	}, [app])

	const clear = useCallback(async () => {
		if (app === null) {
			return
		}

		await app.stop()

		console.log("deleting database")
		await deleteDB(`canvas/v1/${app.topic}`, {})

		console.log("clearing session signer data", sessionSigner)
		await sessionSigner?.clear?.(app.topic)

		window.location.reload()
	}, [app, sessionSigner])

	const spam = useCallback(async () => {
		if (app === null || sessionSigner === null) {
			return
		}

		for (let i = 0; i < 100; i++) {
			const content = bytesToHex(randomBytes(8))
			await app.actions.createMessage({ content }, { signer: sessionSigner })
		}
	}, [app, sessionSigner])

	const button = `p-2 border rounded flex`
	const disabled = `bg-gray-100 text-gray-500 hover:cursor-not-allowed`
	const enabledGreen = `bg-green-100 active:bg-green-300 hover:cursor-pointer hover:bg-green-200`
	const enabledRed = `bg-red-100 active:bg-red-300 hover:cursor-pointer hover:bg-red-200`
	const enabledYellow = `bg-yellow-100 active:bg-yellow-300 hover:cursor-pointer hover:bg-yellow-200`

	if (app === null) {
		return (
			<div className="flex flex-row gap-4">
				<button disabled className={`flex-1 ${button} ${disabled}`}>
					Start libp2p
				</button>
				<button disabled className={`${button} ${disabled}`}>
					Spam
				</button>
				<button disabled className={`${button} ${disabled}`}>
					Clear data
				</button>
			</div>
		)
	} else if (isStarted) {
		return (
			<div className="flex flex-row gap-4">
				<button onClick={() => stop()} className={`flex-1 ${button} ${enabledRed}`}>
					Stop libp2p
				</button>
				<button
					disabled={sessionSigner === null}
					onClick={() => spam()}
					className={`${button} ${sessionSigner === null ? disabled : enabledYellow}`}
				>
					Spam
				</button>
				<button disabled className={`${button} ${disabled}`}>
					Clear data
				</button>
			</div>
		)
	} else {
		return (
			<div className="flex flex-row gap-4">
				<button onClick={() => start()} className={`flex-1 ${button} ${enabledGreen}`}>
					Start libp2p
				</button>
				<button
					disabled={sessionSigner === null}
					onClick={() => spam()}
					className={`${button} ${sessionSigner === null ? disabled : enabledYellow}`}
				>
					Spam
				</button>
				<button onClick={() => clear()} className={`${button} ${enabledRed}`}>
					Clear data
				</button>
			</div>
		)
	}
}
