import React, { useCallback, useContext, useEffect, useState } from "react"
import { deleteDB } from "idb"

import { AppContext } from "./AppContext.js"

const styles = {
	button: `p-2 border rounded flex`,
	disabled: `bg-gray-100 text-gray-500 hover:cursor-not-allowed`,
	enabledGreen: `bg-green-100 hover:cursor-pointer hover:bg-green-200 active:bg-green-300`,
	enabledRed: `bg-red-100 hover:cursor-pointer hover:bg-red-200 active:bg-red-300`,
}

export interface ControlPanelProps {}

export const ControlPanel: React.FC<ControlPanelProps> = ({}) => {
	const { app, sessionSigner } = useContext(AppContext)

	const [status, setStatus] = useState<"stopped" | "starting" | "started" | "stopping">("stopped")
	const handleLibp2pStart = useCallback(() => setStatus("started"), [])
	const handleLibp2pStop = useCallback(() => setStatus("stopped"), [])

	useEffect(() => {
		if (app === null) {
			return
		}

		app.libp2p.addEventListener("start", handleLibp2pStart)
		app.libp2p.addEventListener("stop", handleLibp2pStop)

		return () => {
			app.libp2p.removeEventListener("start", handleLibp2pStart)
			app.libp2p.removeEventListener("stop", handleLibp2pStop)
		}
	}, [app])

	const start = useCallback(() => {
		if (app === null) {
			return
		}

		setStatus("starting")
		app.libp2p.start()
	}, [app])

	const stop = useCallback(() => {
		if (app === null) {
			return
		}

		setStatus("stopping")
		app.libp2p.stop()
	}, [app])

	const clear = useCallback(async () => {
		if (app !== null) {
			await app.close()

			console.log("deleting model database")
			await deleteDB(`canvas/${app.topic}/db`, {})

			console.log("deleting message log", app.topic)
			await deleteDB(`canvas/${app.topic}/log`, {})
			console.log("clearing session signer data", sessionSigner)
			// await sessionSigner?.clear?.()
			window.location.reload()
		}
	}, [app, sessionSigner])

	if (app === null) {
		return (
			<div className="flex flex-row gap-4">
				<button disabled className={`flex-1 ${styles.button} ${styles.disabled}`}>
					Start libp2p
				</button>
				<button disabled className={`${styles.button} ${styles.disabled}`}>
					Clear data
				</button>
			</div>
		)
	} else if (status === "stopped") {
		return (
			<div className="flex flex-row gap-4">
				<button onClick={start} className={`flex-1 ${styles.button} ${styles.enabledGreen}`}>
					Start libp2p
				</button>
				<button onClick={() => clear()} className={`${styles.button} ${styles.enabledRed}`}>
					Clear data
				</button>
			</div>
		)
	} else if (status === "starting") {
		return (
			<div className="flex flex-row gap-4">
				<button disabled className={`flex-1 ${styles.button} ${styles.disabled}`}>
					Starting
				</button>
				<button disabled className={`${styles.button} ${styles.disabled}`}>
					Clear data
				</button>
			</div>
		)
	} else if (status === "started") {
		return (
			<div className="flex flex-row gap-4">
				<button onClick={stop} className={`flex-1 ${styles.button} ${styles.enabledRed}`}>
					Stop libp2p
				</button>
				<button disabled className={`${styles.button} ${styles.disabled}`}>
					Clear data
				</button>
			</div>
		)
	} else if (status === "stopping") {
		return (
			<div className="flex flex-row gap-4">
				<button disabled className={`flex-1 ${styles.button} ${styles.disabled}`}>
					Stopping
				</button>
				<button disabled className={`${styles.button} ${styles.disabled}`}>
					Clear data
				</button>
			</div>
		)
	} else {
		return null
	}
}
