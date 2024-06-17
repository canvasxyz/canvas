import React, { useCallback, useContext, useState } from "react"
import { deleteDB } from "idb"

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
		if (app !== null) {
			try {
				await app.libp2p.stop()
				setIsStarted(false)
			} catch (err) {
				console.error(err)
			}
		}
	}, [app])

	const clear = useCallback(async () => {
		if (app !== null) {
			await app.stop()

			console.log("deleting model database")
			await deleteDB(`canvas/${app.topic}/db`, {})

			console.log("deleting message log", app.topic)
			await deleteDB(`canvas/${app.topic}/log`, {})
			console.log("clearing session signer data", sessionSigner)
			// await sessionSigner?.clear?.()
			window.location.reload()
		}
	}, [app, sessionSigner])

	const button = `p-2 border rounded flex`
	const disabled = `bg-gray-100 text-gray-500 hover:cursor-not-allowed`
	const enabledGreen = `bg-green-100 hover:cursor-pointer hover:bg-green-200 active:bg-green-300`
	const enabledRed = `bg-red-100 hover:cursor-pointer hover:bg-red-200 active:bg-red-300`

	if (app === null) {
		return (
			<div className="flex flex-row gap-4">
				<button disabled className={`flex-1 ${button} ${disabled}`}>
					Start libp2p
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
				<button onClick={() => clear()} className={`${button} ${enabledRed}`}>
					Clear data
				</button>
			</div>
		)
	}
}
