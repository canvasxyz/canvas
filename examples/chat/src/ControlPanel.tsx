import React, { useCallback, useContext, useEffect, useState } from "react"
import { deleteDB } from "idb"

import { AppContext } from "./AppContext.js"
import { UserAddress } from "./UserAddress.js"
import { location } from "./utils.js"

export interface ConnectStatusProps {}

export const ConnectStatus: React.FC<ConnectStatusProps> = ({}) => {
	const { address, signer } = useContext(AppContext)
	if (signer === null || address === null) {
		return null
	}

	return (
		<div className="p-2 border rounded flex flex-col gap-2">
			<div>
				<span className="text-sm">Address</span>
			</div>
			<div>
				<UserAddress address={address} />
			</div>
		</div>
	)
}

export interface ControlPanelProps {}

export const ControlPanel: React.FC<ControlPanelProps> = ({}) => {
	const { app } = useContext(AppContext)

	const [isStarted, setIsStarted] = useState(false)

	const start = useCallback(async () => {
		if (app !== null) {
			try {
				await app.start()
				setIsStarted(true)
			} catch (err) {
				console.error(err)
			}
		}
	}, [app])

	const stop = useCallback(async () => {
		if (app !== null) {
			try {
				await app.stop()
				setIsStarted(false)
			} catch (err) {
				console.error(err)
			}
		}
	}, [app])

	const clear = useCallback(async () => {
		if (app !== null) {
			await app.close()

			console.log("deleting model database")
			await deleteDB(`${location}/db`, {})

			console.log("deleting session database")
			await deleteDB(`${location}/sessions`, {})

			console.log("deleting message log", app.topic)
			await deleteDB(`${location}/topics/${app.topic}`, {})

			console.log("clearing localStorage")
			window.localStorage.clear()
			window.location.reload()
		}
	}, [app])

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
